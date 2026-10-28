import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  buildChildProcessEnv,
  killProcessTree,
  spawnCommand,
} from "@cocurdex/agent-adapters";
import {
  isMemoryImportance,
  type MemoryDoctorCheck,
  type MemoryDoctorReport,
  type MemoryEntry,
  type MemoryImportance,
  type MemoryRecallItem,
  type MemorySettings,
} from "@cocurdex/shared";

const VERSION_TIMEOUT_MS = 20_000;
const CONFIG_TIMEOUT_MS = 30_000;
const DOCTOR_TIMEOUT_MS = 180_000;
const RECALL_TIMEOUT_MS = 25_000;
const SHOW_TIMEOUT_MS = 25_000;
const REMEMBER_TIMEOUT_MS = 180_000;
const INSTALL_TIMEOUT_MS = 300_000;
const POLICY_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 2_000_000;

const ANSI_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`,
  "g",
);

export interface RsrsRunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface RsrsCommandFailure extends Error {
  code?: string;
  stderr?: string;
}

export interface RsrsExecutable {
  command: string;
  source: "configured" | "native" | "path";
}

export interface RsrsConfig {
  dataDir: string | null;
  server: string | null;
  account: string | null;
  space: string | null;
  version: string | null;
}

export interface RsrsDoctorResult {
  report: MemoryDoctorReport;
  installed: boolean;
}

export interface RsrsCommandOptions {
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function stripAnsi(text: string) {
  return text.replace(ANSI_PATTERN, "");
}

function decodeOutput(buffer: Buffer) {
  return stripAnsi(buffer.toString("utf8")).replace(/^\uFEFF/, "");
}

function commandError(
  message: string,
  code: string,
  stderr?: string,
): RsrsCommandFailure {
  const error = new Error(message) as RsrsCommandFailure;
  error.code = code;
  error.stderr = stderr;
  return error;
}

export async function runRsrs(
  executable: RsrsExecutable,
  args: readonly string[],
  options: RsrsCommandOptions = {},
): Promise<RsrsRunResult> {
  const timeoutMs = options.timeoutMs ?? VERSION_TIMEOUT_MS;
  const extraEnv: NodeJS.ProcessEnv = {};
  for (const name of ["RSRS_LIBC", "RESPIRE_LIBC", "ONEMEMORY_LIBC"]) {
    const value = process.env[name];
    if (value) extraEnv[name] = value;
  }
  const env = buildChildProcessEnv(process.env, { extraEnv });

  return new Promise<RsrsRunResult>((resolve, reject) => {
    let settled = false;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const child = spawnCommand(executable.command, args, {
      cwd: options.cwd ?? homedir(),
      env: options.env ?? env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finish = (result: RsrsRunResult | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };
    const kill = (reason: string) => {
      if (child.pid !== undefined) {
        void killProcessTree(child.pid).catch(() => undefined);
      }
      finish(commandError(reason, "timeout"));
    };
    const timer = setTimeout(
      () => kill(`rsrs ${args[0] ?? "command"} timed out after ${timeoutMs}ms`),
      timeoutMs,
    );
    timer.unref?.();

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        kill("rsrs output exceeded the size limit");
        return;
      }
      stdout.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_OUTPUT_BYTES) return;
      stderr.push(chunk);
    });
    child.once("error", (error) => {
      finish(
        commandError(`Could not start rsrs: ${error.message}`, "spawn_failed"),
      );
    });
    child.once("close", (code, signal) => {
      const out = decodeOutput(Buffer.concat(stdout));
      const err = decodeOutput(Buffer.concat(stderr));
      if (signal) {
        finish(
          commandError(`rsrs was terminated by ${signal}`, "terminated", err),
        );
        return;
      }
      finish({ stdout: out, stderr: err, code });
    });
  });
}

function jsonCandidates(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  const candidates: string[] = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  const lines = trimmed.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (line?.startsWith("{") && line.endsWith("}")) {
      candidates.push(line);
    }
  }
  return candidates;
}

export function parseRsrsJson(stdout: string): Record<string, unknown> {
  for (const candidate of jsonCandidates(stdout)) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  throw commandError("rsrs returned output that is not valid JSON", "bad_json");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function rsrsErrorText(payload: Record<string, unknown>) {
  const errors = Array.isArray(payload.errors)
    ? payload.errors.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  if (errors.length > 0) return errors.join("; ");
  const summary = asRecord(payload.summary);
  return stringValue(summary?.reason) ?? null;
}

export function parseVersion(stdout: string) {
  const match = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/.exec(stdout);
  return match?.[1] ?? null;
}

async function exists(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function resolveRsrsExecutable(
  settings: MemorySettings,
): Promise<RsrsExecutable | null> {
  if (settings.cliPath) {
    const configured = {
      command: settings.cliPath,
      source: "configured" as const,
    };
    try {
      const result = await runRsrs(configured, ["--version"], {
        timeoutMs: 5_000,
      });
      if (result.code === 0 || parseVersion(result.stdout)) {
        return configured;
      }
    } catch {
      // Fall through to the native binary or PATH.
    }
  }
  const nativeName = process.platform === "win32" ? "rsrs.exe" : "rsrs";
  const nativePath = path.join(homedir(), ".rsrs", "bin", nativeName);
  if (await exists(nativePath)) {
    return { command: nativePath, source: "native" };
  }
  try {
    const result = await runRsrs(
      { command: "rsrs", source: "path" },
      ["--version"],
      { timeoutMs: VERSION_TIMEOUT_MS },
    );
    if (result.code === 0 || parseVersion(result.stdout)) {
      return { command: "rsrs", source: "path" };
    }
  } catch {
    // Not installed or not on PATH.
  }
  return null;
}

export async function readRsrsVersion(
  executable: RsrsExecutable,
  timeoutMs = VERSION_TIMEOUT_MS,
) {
  const result = await runRsrs(executable, ["--version"], { timeoutMs });
  return parseVersion(`${result.stdout}\n${result.stderr}`);
}

export async function readRsrsConfig(
  executable: RsrsExecutable,
  timeoutMs = CONFIG_TIMEOUT_MS,
): Promise<RsrsConfig> {
  const result = await runRsrs(executable, ["config", "--json"], {
    timeoutMs,
  });
  const payload = parseRsrsJson(result.stdout);
  const summary = asRecord(payload.summary) ?? {};
  return {
    dataDir: stringValue(summary.data_dir),
    server: stringValue(summary.addr),
    account: stringValue(summary.account) ?? stringValue(summary.user),
    space: stringValue(summary.space),
    version: null,
  };
}

function doctorStatus(value: unknown): MemoryDoctorCheck["status"] {
  return value === "ok" ||
    value === "warn" ||
    value === "fail" ||
    value === "skip"
    ? value
    : "skip";
}

export async function readRsrsDoctor(
  executable: RsrsExecutable,
  options: { remote?: boolean; checkUpdate?: boolean } = {},
): Promise<RsrsDoctorResult> {
  const args = ["doctor", "--json"];
  if (options.remote) args.push("--remote");
  if (options.checkUpdate) args.push("--check-update");
  const result = await runRsrs(executable, args, {
    timeoutMs: DOCTOR_TIMEOUT_MS,
  });
  const payload = parseRsrsJson(result.stdout);
  const summary = asRecord(payload.summary) ?? {};
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const checks: MemoryDoctorCheck[] = rawItems.flatMap((item) => {
    const record = asRecord(item);
    const name = stringValue(record?.name);
    if (!name) return [];
    return [
      {
        name,
        status: doctorStatus(record?.status),
        value: stringValue(record?.value) ?? "",
      },
    ];
  });
  const criticalChecks = new Set([
    "store",
    "data dir",
    "session",
    "embedder",
    "model index",
    "memory status",
    "lock",
  ]);
  const criticalFailed = checks.some(
    (check) => criticalChecks.has(check.name) && check.status === "fail",
  );
  const status = criticalFailed
    ? "fail"
    : (Number(summary.fail) || 0) > 0 || (Number(summary.warn) || 0) > 0
      ? "warn"
      : "ok";
  const installed = !criticalFailed;
  return {
    report: {
      status,
      version: stringValue(summary.version),
      summary: {
        total: Number(summary.total) || checks.length,
        pass: Number(summary.pass) || 0,
        warn: Number(summary.warn) || 0,
        fail: Number(summary.fail) || 0,
        skip: Number(summary.skip) || 0,
      },
      checks,
      checkedAt: new Date().toISOString(),
    },
    installed,
  };
}

export function parseRecallPayload(
  payload: Record<string, unknown>,
): MemoryRecallItem[] {
  const details = Array.isArray(payload.details) ? payload.details : [];
  const fromDetails = details.flatMap((entry) => {
    const record = asRecord(entry);
    const id = stringValue(record?.id);
    const title = stringValue(record?.title);
    if (!id) return [];
    return [
      {
        id,
        title: title ?? id,
        score: numberValue(record?.score),
        importance: isMemoryImportance(record?.importance)
          ? record.importance
          : null,
        updatedAt: stringValue(record?.updatedAt),
      },
    ];
  });
  if (fromDetails.length > 0) return fromDetails;

  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.flatMap((entry) => {
    const record = asRecord(entry);
    const id = stringValue(record?.name);
    if (!id) return [];
    const value = stringValue(record?.value) ?? "";
    const match = /^([0-9.]+)\s+(.*)$/.exec(value);
    return [
      {
        id,
        title: match?.[2]?.trim() || value || id,
        score: match ? Number(match[1]) : null,
        importance: null,
        updatedAt: null,
      },
    ];
  });
}

export function parseShowPayload(
  payload: Record<string, unknown>,
): MemoryEntry | null {
  const details = asRecord(payload.details);
  const entry = asRecord(details?.entry);
  if (!entry) return null;
  const id = stringValue(entry.id);
  if (!id) return null;
  return {
    id,
    title: stringValue(entry.title) ?? id,
    content: stringValue(entry.content) ?? "",
    importance: isMemoryImportance(entry.importance) ? entry.importance : null,
    kind: stringValue(entry.kind),
    project: stringValue(entry.project),
    tags: stringArray(entry.tags),
    parentId: stringValue(entry.parent_id),
    createdAt: stringValue(entry.created_at),
    updatedAt: stringValue(entry.updated_at),
    device: stringValue(entry.device),
  };
}

export function parseRememberPayload(payload: Record<string, unknown>): {
  action: "created" | "candidates" | "merged" | "skipped";
  id: string | null;
  title: string | null;
  candidates: MemoryRecallItem[];
  message: string | null;
} {
  const summary = asRecord(payload.summary) ?? {};
  const rawAction = stringValue(summary.action) ?? "";
  const id = stringValue(summary.id);
  const title = stringValue(summary.title);
  const message = rsrsErrorText(payload);
  const candidates = parseRecallPayload(payload);
  if (rawAction === "created" && id) {
    return { action: "created", id, title, candidates: [], message };
  }
  if (rawAction === "merged" || rawAction === "merge") {
    return { action: "merged", id, title, candidates: [], message };
  }
  if (candidates.length > 0) {
    return { action: "candidates", id, title, candidates, message };
  }
  if (id) {
    return { action: "created", id, title, candidates: [], message };
  }
  return { action: "skipped", id: null, title: null, candidates: [], message };
}

export async function recallMemories(
  executable: RsrsExecutable,
  input: {
    query: string;
    limit?: number;
    project?: string | null;
    timeoutMs?: number;
  },
) {
  const args = [
    "recall",
    input.query,
    "--titles",
    "--json",
    "--limit",
    String(input.limit ?? 8),
  ];
  if (input.project) {
    args.push("--project", input.project);
  }
  const result = await runRsrs(executable, args, {
    timeoutMs: input.timeoutMs ?? RECALL_TIMEOUT_MS,
  });
  const payload = parseRsrsJson(result.stdout);
  return {
    items: parseRecallPayload(payload),
    error: rsrsErrorText(payload),
  };
}

export async function showMemory(
  executable: RsrsExecutable,
  id: string,
  timeoutMs = SHOW_TIMEOUT_MS,
) {
  const result = await runRsrs(executable, ["show", id, "--json"], {
    timeoutMs,
  });
  const payload = parseRsrsJson(result.stdout);
  return {
    entry: parseShowPayload(payload),
    error: rsrsErrorText(payload),
  };
}

export interface RememberCommandInput {
  content: string;
  title: string;
  importance?: MemoryImportance;
  tags?: string[];
  project?: string | null;
  parentId?: string | null;
  type?: string | null;
  force?: boolean;
  mergeIds?: string[];
  supersedes?: string[];
  seeAlso?: string[];
}

function appendFlag(args: string[], name: string, value: string | null) {
  if (value) args.push(name, value);
}

export async function rememberMemory(
  executable: RsrsExecutable,
  input: RememberCommandInput,
  timeoutMs = REMEMBER_TIMEOUT_MS,
) {
  const args = ["remember", input.content, "--json"];
  appendFlag(args, "--title", input.title);
  appendFlag(args, "--importance", input.importance ?? null);
  appendFlag(args, "--type", input.type ?? null);
  appendFlag(args, "--project", input.project ?? null);
  appendFlag(args, "--parent", input.parentId ?? null);
  if (input.tags?.length) args.push("--tags", input.tags.join(","));
  if (input.force) args.push("--force");
  if (input.mergeIds?.length)
    args.push("--merge-ids", input.mergeIds.join(","));
  if (input.supersedes?.length) {
    args.push("--supersedes", input.supersedes.join(","));
  }
  if (input.seeAlso?.length) args.push("--see-also", input.seeAlso.join(","));
  const result = await runRsrs(executable, args, { timeoutMs });
  const payload = parseRsrsJson(result.stdout);
  return parseRememberPayload(payload);
}

export async function readRsrsPolicy(executable: RsrsExecutable) {
  const result = await runRsrs(executable, ["prompt"], {
    timeoutMs: POLICY_TIMEOUT_MS,
  });
  return result.stdout.trim();
}

function quoteForShell(value: string) {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

export async function installRsrs(input: {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<{ command: string; output: string }> {
  const timeoutMs = input.timeoutMs ?? INSTALL_TIMEOUT_MS;
  const attempts: Array<{ command: string; args: string[] }> = [
    { command: "npm", args: ["install", "-g", "@rsrsai/cli@latest"] },
    { command: "pnpm", args: ["add", "-g", "@rsrsai/cli@latest"] },
  ];
  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = await runRsrs(
        { command: attempt.command, source: "path" },
        attempt.args,
        { timeoutMs, env: input.env, cwd: homedir() },
      );
      if (result.code === 0) {
        return {
          command: `${attempt.command} ${attempt.args.map(quoteForShell).join(" ")}`,
          output: result.stdout,
        };
      }
      failures.push(
        `${attempt.command} exited with ${result.code ?? "unknown"}: ${
          result.stderr.trim() || result.stdout.trim() || "no output"
        }`,
      );
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : `${attempt.command} failed`,
      );
    }
  }
  throw commandError(
    `Could not install the rsrs CLI. Install Node.js/npm and run "npm install -g @rsrsai/cli@latest". ${failures.join(" | ")}`,
    "install_failed",
  );
}

export async function materializeNativeBinary(
  executable: RsrsExecutable,
): Promise<RsrsExecutable | null> {
  try {
    const result = await runRsrs(executable, ["v"], {
      timeoutMs: VERSION_TIMEOUT_MS,
    });
    if (result.code !== 0) return null;
  } catch {
    return null;
  }
  const nativeName = process.platform === "win32" ? "rsrs.exe" : "rsrs";
  const nativePath = path.join(homedir(), ".rsrs", "bin", nativeName);
  if (await exists(nativePath)) {
    return { command: nativePath, source: "native" };
  }
  return executable;
}
