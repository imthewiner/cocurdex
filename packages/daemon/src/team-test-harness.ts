import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAgentRegistry } from "@cocurdex/agent-core";
import type { MessageRecord } from "@cocurdex/shared";
import { sessionConfiguration } from "@cocurdex/shared";
import { afterEach, vi } from "vitest";
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

export async function createService(userDataPath?: string) {
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

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

export function assistantMessage(
  sessionId: string,
  content: string,
): MessageRecord {
  return {
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant",
    content,
    attachments: [],
    createdAt: new Date().toISOString(),
  };
}

export interface Turn {
  payload: SessionRuntimeMessage;
  finish(content: string): void;
}

export function scriptRuntime(service: CocurdexDaemonService) {
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
