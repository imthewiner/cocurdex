import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAgentRegistry } from "@cocurdex/agent-core";
import type { MessageRecord } from "@cocurdex/shared";
import {
  sessionConfiguration,
  teammateReportMessageId,
} from "@cocurdex/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CocurdexDaemonService } from "./service";
import type { SessionRuntimeMessage } from "./session-control";

const directories: string[] = [];
const timestamp = "2026-10-11T00:00:00.000Z";

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createService(userDataPath?: string) {
  const root =
    userDataPath ?? (await mkdtemp(path.join(tmpdir(), "cocurdex-team-")));
  if (!userDataPath) directories.push(root);
  const service = new CocurdexDaemonService({
    runtimeFingerprint: "test",
    userDataPath: root,
  });
  const pi = createAgentRegistry()
    .list()
    .find((agent) => agent.id === "pi");
  if (!pi) throw new Error("Pi descriptor not found");
  vi.spyOn(service, "listAgents").mockResolvedValue([
    { ...pi, availability: "available" },
  ]);
  if (!userDataPath) {
    await service.saveWorkspace({
      id: "workspace-1",
      name: "Team",
      rootPaths: [root],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      sortOrder: 1000,
    });
    await service.saveSessionConfiguration(
      sessionConfiguration({
        id: "lead",
        workspaceId: "workspace-1",
        title: "Lead",
        agentType: "pi",
        status: "idle",
        writeMode: "read-only",
        sessionModeId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastMessageAt: null,
      }),
    );
  }
  return { service, root };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

function assistantMessage(sessionId: string, content: string): MessageRecord {
  return {
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant",
    content,
    attachments: [],
    createdAt: new Date().toISOString(),
  };
}

interface Turn {
  payload: SessionRuntimeMessage;
  finish(content: string): void;
}

function scriptRuntime(service: CocurdexDaemonService) {
  const turns: Turn[] = [];
  vi.spyOn(service.runtime, "sendSessionMessage").mockImplementation(
    async (payload) => {
      if (payload.delivery === "steer-active-run") {
        return assistantMessage(payload.session.id, "");
      }
      const reply = deferred<MessageRecord>();
      turns.push({
        payload,
        finish: (content) => {
          const message = assistantMessage(payload.session.id, content);
          service.runtime.emitAgentEvent({
            type: "message.completed",
            sessionId: payload.session.id,
            message,
          });
          reply.resolve(message);
        },
      });
      return reply.promise;
    },
  );
  const turnFor = (sessionId: string) =>
    vi.waitFor(() => {
      const turn = turns.find((item) => item.payload.session.id === sessionId);
      if (!turn) throw new Error(`No turn for ${sessionId}`);
      return turn;
    });
  return { turns, turnFor };
}

async function spawnTeammate(service: CocurdexDaemonService) {
  const member = await service.team.spawn("lead", {
    name: "alpha",
    prompt: "Review the auth module",
  });
  const runId = service.runs.activeRunId(member.sessionId);
  if (!runId) throw new Error("Teammate run did not start");
  return { member, runId };
}

describe("teammate reports", () => {
  it("wakes an idle lead with the teammate's final reply", async () => {
    const { service } = await createService();
    const runtime = scriptRuntime(service);
    try {
      const { member, runId } = await spawnTeammate(service);
      (await runtime.turnFor(member.sessionId)).finish("Auth looks fine");

      const reportId = teammateReportMessageId(runId);
      await vi.waitFor(() =>
        expect(service.runs.activeRuns()).toEqual([
          expect.objectContaining({
            sessionId: "lead",
            triggerMessageId: reportId,
          }),
        ]),
      );
      const report = await service.state.getMessageById(reportId);
      expect(report?.content).toBe(
        '[Teammate "alpha" finished]\nAuth looks fine',
      );
    } finally {
      for (const turn of runtime.turns) turn.finish("cleanup");
      await service.shutdown();
    }
  });

  it("steers a running lead without ending its run", async () => {
    const { service } = await createService();
    const runtime = scriptRuntime(service);
    try {
      await service.sendSessionMessage({
        sessionId: "lead",
        messageId: "lead-task",
        content: "Coordinate the review",
      });
      const leadRunId = service.runs.activeRunId("lead");
      const { member, runId } = await spawnTeammate(service);
      (await runtime.turnFor(member.sessionId)).finish("Auth looks fine");

      const reportId = teammateReportMessageId(runId);
      await vi.waitFor(async () =>
        expect(await service.state.getMessageById(reportId)).toMatchObject({
          runId: leadRunId,
        }),
      );
      expect(service.runs.activeRunId("lead")).toBe(leadRunId);
    } finally {
      for (const turn of runtime.turns) turn.finish("cleanup");
      await service.shutdown();
    }
  });

  it("holds a report lost to a daemon crash until the lead resumes", async () => {
    const { service, root } = await createService();
    const runtime = scriptRuntime(service);
    const { member, runId } = await spawnTeammate(service);
    vi.spyOn(service.team, "onAgentEvent").mockResolvedValue();
    (await runtime.turnFor(member.sessionId)).finish("Auth looks fine");
    await vi.waitFor(() =>
      expect(service.runs.hasActiveRun(member.sessionId)).toBe(false),
    );
    await service.shutdown();

    const restarted = (await createService(root)).service;
    vi.spyOn(restarted.runtime, "sendSessionMessage").mockResolvedValue(
      assistantMessage("lead", ""),
    );
    try {
      restarted.startBackgroundRecovery();
      const reportId = teammateReportMessageId(runId);
      await vi.waitFor(async () =>
        expect(
          (await restarted.state.listQueuedAgentInputs("lead")).map(
            (input) => input.messageId,
          ),
        ).toEqual([reportId]),
      );
      expect(restarted.runs.hasActiveRun("lead")).toBe(false);
      expect(restarted.getActiveWork().queuedInputs).toBe(0);
    } finally {
      await restarted.shutdown();
    }
  });
});
