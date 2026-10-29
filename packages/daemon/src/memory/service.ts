import os from "node:os";
import { generatePiMemoryDigest } from "@cocurdex/agent-adapters";
import {
  type AgentRuntimeProviderConfig,
  buildMemoryRecallQuery,
  type CocurdexDaemonEvent,
  DEFAULT_MEMORY_SETTINGS,
  isChatSession,
  type MemoryDoctorReport,
  type MemoryEntry,
  type MemoryImportance,
  type MemoryInstallResult,
  type MemoryRecallItem,
  type MemoryRecallOutcome,
  type MemoryRecallResult,
  type MemoryRecallStatus,
  type MemoryRememberInput,
  type MemoryRememberResult,
  type MemorySessionSaveInput,
  type MemorySessionSaveResult,
  type MemorySettings,
  type MemoryStatus,
  type MessageRecord,
  memoryProjectForWorkspace,
  redactMemorySecrets,
  type SessionRecord,
} from "@cocurdex/shared";
import { logDaemonDiagnostic } from "../diagnostics";
import { buildSnapshotProviderRecords } from "../provider/session-title";
import type { DaemonState } from "../state";
import {
  buildAgentMemoryPolicy,
  buildGateNudge,
  buildMemoryBrief,
  buildSessionDigestFallback,
  buildTranscriptForSummary,
  buildTurnDiaryLine,
  compactText as compactDigestText,
  conversationTurns,
} from "./digest";
import {
  installRsrs,
  materializeNativeBinary,
  type RsrsExecutable,
  readRsrsConfig,
  readRsrsDoctor,
  readRsrsPolicy,
  readRsrsVersion,
  recallMemories,
  rememberMemory,
  resolveRsrsExecutable,
  showMemory,
} from "./rsrs";
import {
  type MemoryCaptureMap,
  type MemoryInstallState,
  readMemoryCaptures,
  readMemoryInstallState,
  readMemorySettings,
  shouldAutoInstall,
  writeMemoryCapture,
  writeMemoryInstallState,
  writeMemorySettings,
} from "./settings";

const STATUS_CACHE_MS = 30_000;
const TURN_RECALL_BUDGET_MS = 2_000;
const CHAT_EXCERPT_BUDGET_MS = 4_000;
const SESSION_DIGEST_TIMEOUT_MS = 60_000;

type MemoryState = Pick<
  DaemonState,
  | "getAppSetting"
  | "setAppSetting"
  | "getSession"
  | "listSessions"
  | "listMessagesBySessionId"
  | "listWorkspaces"
>;

export interface MemoryServiceOptions {
  userDataPath: string;
  state: MemoryState;
  broadcast(event: CocurdexDaemonEvent): void;
  resolveSessionProvider(
    session: SessionRecord,
  ): Promise<AgentRuntimeProviderConfig | null>;
  autoInstall?: boolean;
  device?: string;
  now?: () => Date;
}

export interface MemoryTurnContext {
  brief: string | null;
  items: MemoryRecallItem[];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class MemoryService {
  private settings: MemorySettings | null = null;
  private installState: MemoryInstallState | null = null;
  private initialization: Promise<void> | null = null;
  private executable: RsrsExecutable | null = null;
  private executableResolvedAt = 0;
  private statusCache: { status: MemoryStatus; at: number } | null = null;
  private installPromise: Promise<MemoryInstallResult> | null = null;
  private doctorPromise: Promise<MemoryDoctorReport> | null = null;
  private policyCache: string | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private readQueue: Promise<void> = Promise.resolve();
  private startupPromise: Promise<void> | null = null;
  private readonly gateTurns = new Map<
    string,
    { stored: boolean; nudge: boolean }
  >();
  private lastRecall: MemoryRecallStatus | null = null;
  private readonly device: string;
  private readonly now: () => Date;

  constructor(private readonly options: MemoryServiceOptions) {
    this.device = options.device ?? `${os.hostname()}/${process.platform}`;
    this.now = options.now ?? (() => new Date());
  }

  private async ensureInitialized() {
    if (!this.initialization) {
      this.initialization = (async () => {
        try {
          this.settings = await readMemorySettings(this.options.state);
          this.installState = await readMemoryInstallState(this.options.state);
        } catch (error) {
          logDaemonDiagnostic("warn", "memory.initializeFailed", {
            error: errorMessage(error),
          });
          this.settings = null;
          this.installState = null;
        }
      })();
    }
    await this.initialization;
  }

  private currentSettings(): MemorySettings {
    return this.settings ?? DEFAULT_MEMORY_SETTINGS;
  }

  private currentInstallState(): MemoryInstallState {
    return (
      this.installState ?? {
        attemptedAt: null,
        status: "idle",
        version: null,
        executable: null,
        error: null,
        doctor: null,
      }
    );
  }

  isEnabledSync() {
    return this.settings?.enabled ?? true;
  }

  areToolsEnabledSync() {
    const settings = this.settings;
    return Boolean(settings?.enabled && settings.agent.tools);
  }

  private isReadyForTurns() {
    if (!this.settings?.enabled) return false;
    return (
      this.statusCache?.status.available === true ||
      this.installState?.status === "ready"
    );
  }

  async getSettings(): Promise<MemorySettings> {
    await this.ensureInitialized();
    return this.currentSettings();
  }

  async setSettings(input: MemorySettings): Promise<MemorySettings> {
    await this.ensureInitialized();
    const settings = await writeMemorySettings(this.options.state, input);
    this.settings = settings;
    this.statusCache = null;
    this.broadcast();
    if (settings.enabled && this.options.autoInstall === true) {
      void (async () => {
        try {
          if (await this.resolveExecutable()) return;
          await this.install(false);
        } catch (error) {
          logDaemonDiagnostic("warn", "memory.autoInstallFailed", {
            error: errorMessage(error),
          });
        }
      })();
    }
    return settings;
  }

  async initializeOnStartup() {
    if (this.startupPromise) return this.startupPromise;
    this.startupPromise = (async () => {
      await this.ensureInitialized();
      const settings = this.currentSettings();
      if (!settings.enabled) return;
      if (this.currentInstallState().status === "installing") {
        await this.persistInstallState({
          ...this.currentInstallState(),
          status: "idle",
        });
      }
      const executable = await this.resolveExecutable();
      if (!executable) {
        if (shouldAutoInstall(settings, this.currentInstallState())) {
          void this.install(false);
        }
        return;
      }
      const state = this.currentInstallState();
      const attemptedAt = state.attemptedAt ? Date.parse(state.attemptedAt) : 0;
      const stale =
        !attemptedAt ||
        this.now().getTime() - attemptedAt > 24 * 60 * 60 * 1000;
      if (state.status !== "ready" || stale) {
        void this.doctor();
      }
    })();
    return this.startupPromise;
  }

  private async resolveExecutable(force = false) {
    await this.ensureInitialized();
    if (!force && this.executable) return this.executable;
    if (
      !force &&
      this.now().getTime() - this.executableResolvedAt < STATUS_CACHE_MS
    ) {
      return this.executable;
    }
    const resolved = await resolveRsrsExecutable(this.currentSettings());
    this.executable =
      resolved?.source === "path"
        ? ((await materializeNativeBinary(resolved)) ?? resolved)
        : resolved;
    this.executableResolvedAt = this.now().getTime();
    return this.executable;
  }

  private async persistInstallState(state: MemoryInstallState) {
    this.installState = state;
    this.statusCache = null;
    try {
      await writeMemoryInstallState(this.options.state, state);
    } catch (error) {
      logDaemonDiagnostic("warn", "memory.installStateWriteFailed", {
        error: errorMessage(error),
      });
    }
    this.broadcast();
  }

  private broadcast() {
    this.options.broadcast({ type: "data.changed", areas: ["memory"] });
  }

  async getStatus(refresh = false): Promise<MemoryStatus> {
    const status = await this.computeStatus(refresh);
    return { ...status, lastRecall: this.lastRecall };
  }

  private async computeStatus(refresh = false): Promise<MemoryStatus> {
    await this.ensureInitialized();
    const now = this.now().getTime();
    if (
      !refresh &&
      this.statusCache &&
      now - this.statusCache.at < STATUS_CACHE_MS
    ) {
      return this.statusCache.status;
    }
    const settings = this.currentSettings();
    const installState = this.currentInstallState();
    const executable = await this.resolveExecutable(refresh);
    if (!executable) {
      const status: MemoryStatus = {
        settings,
        enabled: settings.enabled,
        available: false,
        installation:
          installState.status === "installing"
            ? "installing"
            : installState.status === "failed"
              ? "failed"
              : "missing",
        version: installState.version,
        executable: null,
        dataDir: null,
        account: null,
        space: null,
        doctor: installState.doctor,
        error: installState.error,
        checkedAt: installState.attemptedAt,
        lastRecall: null,
      };
      this.statusCache = { status, at: now };
      return status;
    }
    const [versionResult, configResult] = await Promise.allSettled([
      readRsrsVersion(executable, 4_000),
      readRsrsConfig(executable, 6_000),
    ]);
    const version =
      versionResult.status === "fulfilled"
        ? (versionResult.value ?? installState.version)
        : installState.version;
    const config =
      configResult.status === "fulfilled" ? configResult.value : null;
    const dataDir = config?.dataDir ?? null;
    const account = config?.account ?? null;
    const space = config?.space ?? null;
    const error =
      configResult.status === "rejected"
        ? errorMessage(configResult.reason)
        : versionResult.status === "rejected"
          ? errorMessage(versionResult.reason)
          : null;
    const status: MemoryStatus = {
      settings,
      enabled: settings.enabled,
      available: true,
      installation:
        installState.status === "installing" ? "installing" : "ready",
      version,
      executable: executable.command,
      dataDir,
      account,
      space,
      doctor: installState.doctor,
      error,
      checkedAt: this.now().toISOString(),
      lastRecall: null,
    };
    this.statusCache = { status, at: now };
    return status;
  }

  async install(force = false): Promise<MemoryInstallResult> {
    await this.ensureInitialized();
    if (this.installPromise) return this.installPromise;
    if (!force) {
      const state = this.currentInstallState();
      if (state.status === "ready" && (await this.resolveExecutable())) {
        return {
          status: await this.getStatus(true),
          installed: true,
          message: null,
        };
      }
    }
    this.installPromise = (async () => {
      const startedAt = this.now().toISOString();
      await this.persistInstallState({
        ...this.currentInstallState(),
        attemptedAt: startedAt,
        status: "installing",
        error: null,
      });
      try {
        let executable = await this.resolveExecutable(true);
        if (!executable) {
          const installed = await installRsrs({});
          logDaemonDiagnostic("info", "memory.installerSucceeded", {
            command: installed.command,
          });
          executable = await this.resolveExecutable(true);
        }
        if (!executable) {
          throw new Error(
            "rsrs was installed but no executable could be resolved",
          );
        }
        executable = (await materializeNativeBinary(executable)) ?? executable;
        this.executable = executable;
        const version = await readRsrsVersion(executable).catch(() => null);
        const doctor = await readRsrsDoctor(executable);
        await this.persistInstallState({
          attemptedAt: this.now().toISOString(),
          status: "ready",
          version: version ?? doctor.report.version,
          executable: executable.command,
          error: null,
          doctor: doctor.report,
        });
        return {
          status: await this.getStatus(true),
          installed: doctor.installed,
          message: doctor.installed
            ? null
            : "rsrs is installed but doctor reported a failing critical check",
        };
      } catch (error) {
        const message = errorMessage(error);
        await this.persistInstallState({
          ...this.currentInstallState(),
          attemptedAt: this.now().toISOString(),
          status: "failed",
          error: message,
        });
        logDaemonDiagnostic("warn", "memory.installFailed", {
          error: message,
        });
        return {
          status: await this.getStatus(true),
          installed: false,
          message,
        };
      } finally {
        this.installPromise = null;
      }
    })();
    return this.installPromise;
  }

  async doctor(options: { remote?: boolean; checkUpdate?: boolean } = {}) {
    await this.ensureInitialized();
    if (this.doctorPromise) return this.doctorPromise;
    this.doctorPromise = (async () => {
      const executable = await this.resolveExecutable(true);
      if (!executable) {
        throw new Error("rsrs is not installed");
      }
      const result = await readRsrsDoctor(executable, options);
      const version = await readRsrsVersion(executable).catch(
        () => result.report.version,
      );
      await this.persistInstallState({
        attemptedAt: this.now().toISOString(),
        status: result.installed ? "ready" : "failed",
        version,
        executable: executable.command,
        error: result.installed
          ? null
          : "rsrs doctor reported a failing critical check",
        doctor: result.report,
      });
      return result.report;
    })().finally(() => {
      this.doctorPromise = null;
    });
    return this.doctorPromise;
  }

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private enqueueRead<T>(task: () => Promise<T>): Promise<T> {
    const run = this.readQueue.then(task, task);
    this.readQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async recall(input: {
    query: string;
    limit?: number;
    project?: string | null;
    timeoutMs?: number;
  }): Promise<MemoryRecallResult> {
    await this.ensureInitialized();
    const query = input.query.trim();
    const limit = Math.min(20, Math.max(1, Math.floor(input.limit ?? 8)));
    if (!query || !this.currentSettings().enabled) {
      return { query, items: [], truncated: false };
    }
    const executable = await this.resolveExecutable();
    if (!executable) {
      return { query, items: [], truncated: false };
    }
    return this.enqueueRead(async () => {
      const result = await recallMemories(executable, {
        query,
        limit,
        project: input.project ?? null,
        timeoutMs: input.timeoutMs,
      });
      if (result.error) {
        logDaemonDiagnostic("info", "memory.recallReportedError", {
          error: result.error,
        });
      }
      return {
        query,
        items: result.items.slice(0, limit),
        truncated: result.items.length > limit,
      };
    });
  }

  async show(id: string, timeoutMs?: number): Promise<MemoryEntry | null> {
    await this.ensureInitialized();
    if (!this.currentSettings().enabled) return null;
    const executable = await this.resolveExecutable();
    if (!executable) return null;
    const result = await this.enqueueRead(() =>
      showMemory(executable, id, timeoutMs),
    );
    if (result.error) {
      logDaemonDiagnostic("info", "memory.showReportedError", {
        error: result.error,
      });
    }
    return result.entry;
  }

  async remember(input: MemoryRememberInput): Promise<MemoryRememberResult> {
    await this.ensureInitialized();
    if (!this.currentSettings().enabled) {
      return {
        action: "skipped",
        id: null,
        title: null,
        candidates: [],
        message: "Memory is disabled",
      };
    }
    const content = redactMemorySecrets(input.content).trim();
    const title = redactMemorySecrets(input.title).trim();
    if (!content || !title) {
      return {
        action: "skipped",
        id: null,
        title: null,
        candidates: [],
        message: "Memory content and title are required",
      };
    }
    const executable = await this.resolveExecutable();
    if (!executable) {
      return {
        action: "skipped",
        id: null,
        title: null,
        candidates: [],
        message: "rsrs is not installed",
      };
    }
    return this.enqueueWrite(async () => {
      const result = await rememberMemory(executable, {
        ...input,
        content,
        title,
      });
      if (result.action === "created") this.broadcast();
      return result;
    });
  }

  async policy() {
    await this.ensureInitialized();
    if (!this.currentSettings().enabled) return "";
    if (this.policyCache) return this.policyCache;
    const executable = await this.resolveExecutable();
    if (!executable) return "";
    try {
      this.policyCache = await readRsrsPolicy(executable);
      return this.policyCache;
    } catch (error) {
      logDaemonDiagnostic("info", "memory.policyReadFailed", {
        error: errorMessage(error),
      });
      return "";
    }
  }

  async beginTurn(input: {
    sessionId: string;
    mode: "agent" | "chat";
    enforce: boolean;
  }): Promise<string | null> {
    await this.ensureInitialized();
    if (
      !this.currentSettings().enabled ||
      !this.isReadyForTurns() ||
      input.mode === "chat" ||
      !input.enforce
    ) {
      this.gateTurns.delete(input.sessionId);
      return null;
    }
    const previous = this.gateTurns.get(input.sessionId);
    this.gateTurns.set(input.sessionId, { stored: false, nudge: false });
    return previous?.nudge === true ? buildGateNudge() : null;
  }

  noteGateToolUse(sessionId: string, tool: "recall" | "show" | "remember") {
    if (tool !== "remember") return;
    const turn = this.gateTurns.get(sessionId);
    if (turn) turn.stored = true;
  }

  async finishTurn(input: {
    sessionId: string;
    enforce: boolean;
  }): Promise<boolean> {
    const turn = this.gateTurns.get(input.sessionId);
    if (!turn) return false;
    await this.ensureInitialized();
    if (
      !input.enforce ||
      !this.currentSettings().enabled ||
      !this.isReadyForTurns() ||
      turn.stored
    ) {
      this.gateTurns.delete(input.sessionId);
      return false;
    }
    turn.nudge = true;
    logDaemonDiagnostic("info", "memory.gateStoreMissed", {
      sessionId: input.sessionId,
    });
    return true;
  }

  async buildTurnContext(
    session: SessionRecord,
    message: string,
    mode: "agent" | "chat",
  ): Promise<MemoryTurnContext | null> {
    await this.ensureInitialized();
    const settings = this.currentSettings();
    if (!this.isReadyForTurns()) return null;
    if (!settings.enabled) return null;
    if (mode === "agent" && !settings.agent.injectContext) return null;
    if (mode === "chat" && !settings.chat.recall) return null;
    const project = await this.projectFor(session);
    const query = buildMemoryRecallQuery({
      project,
      title: session.title,
      message,
    });
    if (!query) return null;
    let result: MemoryRecallResult;
    try {
      result = await this.recall({
        query,
        limit: 6,
        project,
        timeoutMs: TURN_RECALL_BUDGET_MS,
      });
    } catch (error) {
      this.noteRecall(session.id, mode, "failed", errorMessage(error));
      logDaemonDiagnostic("warn", "memory.turnRecallFailed", {
        error: errorMessage(error),
        sessionId: session.id,
      });
      return null;
    }
    if (result.items.length === 0) {
      this.noteRecall(session.id, mode, "empty", null);
      return null;
    }
    this.noteRecall(session.id, mode, "recalled", null);
    const excerpts = new Map<string, string>();
    if (mode === "chat") {
      const selected = result.items.slice(0, 2);
      const shown = await Promise.all(
        selected.map(async (item) => {
          try {
            const entry = await this.show(item.id, CHAT_EXCERPT_BUDGET_MS);
            return entry ? ([item.id, entry.content] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      for (const pair of shown) {
        if (pair) excerpts.set(pair[0], pair[1]);
      }
    }
    return {
      brief: buildMemoryBrief(result.items, {
        excerpts,
        hasTools: mode === "agent",
      }),
      items: result.items,
    };
  }

  private noteRecall(
    sessionId: string,
    mode: "agent" | "chat",
    outcome: MemoryRecallOutcome,
    error: string | null,
  ) {
    const previous = this.lastRecall;
    if (
      previous?.sessionId === sessionId &&
      previous.outcome === outcome &&
      previous.error === error
    ) {
      return;
    }
    this.lastRecall = {
      sessionId,
      mode,
      outcome,
      error,
      at: this.now().toISOString(),
    };
    this.broadcast();
  }

  private async projectFor(session: SessionRecord) {
    const settings = this.currentSettings();
    if (settings.projectMode === "global") return null;
    try {
      const workspaces = await this.options.state.listWorkspaces();
      const workspace = workspaces.find(
        (candidate) => candidate.id === session.workspaceId,
      );
      return memoryProjectForWorkspace(workspace?.name);
    } catch {
      return null;
    }
  }

  async captureTurn(
    sessionId: string,
    assistantMessageId: string | null,
  ): Promise<MemorySessionSaveResult> {
    await this.ensureInitialized();
    const settings = this.currentSettings();
    if (!settings.enabled || !settings.chat.saveTurns) {
      return { saved: false, memoryId: null, reason: "disabled" };
    }
    if (!this.isReadyForTurns()) {
      return { saved: false, memoryId: null, reason: "unavailable" };
    }
    const session = await this.options.state.getSession(sessionId);
    if (!session || !isChatSession(session)) {
      return { saved: false, memoryId: null, reason: "not-chat" };
    }
    const messages =
      await this.options.state.listMessagesBySessionId(sessionId);
    const user = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const assistant = assistantMessageId
      ? messages.find((message) => message.id === assistantMessageId)
      : [...messages].reverse().find((message) => message.role === "assistant");
    if (!user || !assistant || assistant.role !== "assistant") {
      return { saved: false, memoryId: null, reason: "no-turn" };
    }
    const captures = await readMemoryCaptures(this.options.state);
    const previous = captures[sessionId];
    if (
      previous?.kind === "turn" &&
      previous.lastAssistantMessageId === assistant.id
    ) {
      return { saved: false, memoryId: previous.memoryId, reason: "duplicate" };
    }
    const line = buildTurnDiaryLine({
      session,
      userMessage: user.content,
      assistantMessage: assistant.content,
      device: this.device,
      at: assistant.createdAt,
    });
    const result = await this.remember({
      content: redactMemorySecrets(line),
      title: `Cocurdex chat：${compactDigestText(session.title, 48)}`,
      importance: "trivial",
      project: await this.projectFor(session),
      force: true,
    });
    if (!result.id) {
      return {
        saved: false,
        memoryId: null,
        reason: result.message ?? "not-written",
      };
    }
    await writeMemoryCapture(this.options.state, sessionId, {
      memoryId: result.id,
      savedAt: this.now().toISOString(),
      lastAssistantMessageId: assistant.id,
      kind: "turn",
    });
    this.broadcast();
    return { saved: true, memoryId: result.id, reason: null };
  }

  async saveSession(
    input: MemorySessionSaveInput,
  ): Promise<MemorySessionSaveResult> {
    await this.ensureInitialized();
    const settings = this.currentSettings();
    if (!settings.enabled) {
      return { saved: false, memoryId: null, reason: "disabled" };
    }
    if (!settings.chat.saveOnEnd && !input.force) {
      return { saved: false, memoryId: null, reason: "disabled" };
    }
    if (!(await this.resolveExecutable())) {
      return { saved: false, memoryId: null, reason: "unavailable" };
    }
    const session = await this.options.state.getSession(input.sessionId);
    if (!session || !isChatSession(session)) {
      return { saved: false, memoryId: null, reason: "not-chat" };
    }
    const messages = await this.options.state.listMessagesBySessionId(
      session.id,
    );
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    const captures = await readMemoryCaptures(this.options.state);
    const previous = captures[session.id];
    if (
      !input.force &&
      previous?.kind === "session" &&
      previous.lastAssistantMessageId === (lastAssistant?.id ?? null)
    ) {
      return { saved: false, memoryId: previous.memoryId, reason: "duplicate" };
    }
    const turns = conversationTurns(messages);
    if (turns === 0) {
      return { saved: false, memoryId: null, reason: "empty-session" };
    }
    const transcript = buildTranscriptForSummary(messages);
    const digest = await this.summarizeSession(session, transcript);
    const endedAt = this.now().toISOString();
    const startedAt = session.createdAt ? Date.parse(session.createdAt) : NaN;
    const durationSeconds = Number.isFinite(startedAt)
      ? Math.max(0, (Date.parse(endedAt) - startedAt) / 1000)
      : null;
    const lastAssistantText = lastAssistant?.content ?? null;
    const body =
      digest?.body ??
      buildSessionDigestFallback({
        session,
        messages,
        device: this.device,
        endedAt,
        durationSeconds,
        turns,
        outcome: lastAssistantText,
      });
    const importance: MemoryImportance =
      input.importance ?? digest?.importance ?? "trivial";
    const stored = await this.storeSessionMemory({
      content: redactMemorySecrets(body),
      title:
        digest?.title ??
        `Cocurdex chat：${compactDigestText(session.title, 48)}`,
      importance,
      project: await this.projectFor(session),
    });
    if (!stored.id) {
      return {
        saved: false,
        memoryId: null,
        reason: stored.message ?? stored.action,
      };
    }
    await writeMemoryCapture(this.options.state, session.id, {
      memoryId: stored.id,
      savedAt: endedAt,
      lastAssistantMessageId: lastAssistant?.id ?? null,
      kind: "session",
    });
    this.broadcast();
    return { saved: true, memoryId: stored.id, reason: null };
  }

  private async storeSessionMemory(input: {
    content: string;
    title: string;
    importance: MemoryImportance;
    project: string | null;
  }): Promise<MemoryRememberResult> {
    const judged = await this.remember(input);
    if (judged.action !== "candidates" || judged.id) return judged;
    const parentId = judged.candidates[0]?.id ?? null;
    if (!parentId) return judged;
    logDaemonDiagnostic("info", "memory.sessionAttached", {
      parentId,
      title: input.title,
    });
    return this.remember({ ...input, parentId });
  }

  private async summarizeSession(session: SessionRecord, transcript: string) {
    if (!transcript.trim()) return null;
    let runtime: AgentRuntimeProviderConfig | null = null;
    try {
      runtime = await this.options.resolveSessionProvider(session);
    } catch (error) {
      logDaemonDiagnostic("info", "memory.digestProviderFailed", {
        error: errorMessage(error),
        sessionId: session.id,
      });
      return null;
    }
    if (!runtime?.baseUrl || !runtime.modelId) return null;
    const { provider, model } = buildSnapshotProviderRecords(runtime);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      SESSION_DIGEST_TIMEOUT_MS,
    );
    timer.unref?.();
    try {
      return await generatePiMemoryDigest({
        provider,
        model,
        apiKey: runtime.apiKey ?? null,
        sessionTitle: session.title,
        transcript,
        sessionId: session.id,
        signal: controller.signal,
      });
    } catch (error) {
      logDaemonDiagnostic("info", "memory.digestSkipped", {
        error: errorMessage(error),
        sessionId: session.id,
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  agentInstructions(hasTools: boolean) {
    if (!hasTools || !this.isEnabledSync()) return "";
    return buildAgentMemoryPolicy(true);
  }

  async getCaptures(): Promise<MemoryCaptureMap> {
    await this.ensureInitialized();
    return readMemoryCaptures(this.options.state);
  }

  async getTurnMessages(sessionId: string): Promise<MessageRecord[]> {
    return this.options.state.listMessagesBySessionId(sessionId);
  }
}
