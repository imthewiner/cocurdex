import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAgentRegistry } from "@cocurdex/agent-core";
import type { AgentId, MessageRecord } from "@cocurdex/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CocurdexDaemonService } from "./service";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

interface DispatchCall {
  agentType: AgentId;
  content: string;
  historyIds: string[];
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "cocurdex-handoff-"));
  const service = new CocurdexDaemonService({
    userDataPath: root,
    runtimeFingerprint: "test",
  });
  cleanup.push(async () => {
    await service.shutdown();
    await rm(root, { force: true, recursive: true });
  });
  const registry = createAgentRegistry().list();
  vi.spyOn(service, "listAgents").mockResolvedValue(
    registry
      .filter((agent) => agent.id === "pi" || agent.id === "codex")
      .map((agent) => ({ ...agent, availability: "available" as const })),
  );
  vi.spyOn(service.runtime, "createSessionRuntime").mockImplementation(
    () => ({}) as never,
  );
  const calls: DispatchCall[] = [];
  vi.spyOn(service.runtime, "sendSessionMessage").mockImplementation(
    async (payload, options) => {
      calls.push({
        agentType: payload.session.agentType,
        content: payload.content,
        historyIds: options.history.map((message) => message.id),
      });
      const reply: MessageRecord = {
        id: crypto.randomUUID(),
        sessionId: payload.session.id,
        role: "assistant",
        content: `${payload.session.agentType} answer ${calls.length}`,
        attachments: [],
        createdAt: new Date().toISOString(),
      };
      service.runtime.emitAgentEvent({
        type: "message.completed",
        sessionId: payload.session.id,
        message: reply,
      });
      await service.state.saveProviderSession(payload.session.agentType, {
        sessionId: payload.session.id,
        providerSessionId: `${payload.session.agentType}-thread`,
        providerStateJson: "{}",
        providerVersion: null,
        resumable: true,
        updatedAt: reply.createdAt,
      });
      return reply;
    },
  );
  const now = new Date().toISOString();
  await service.saveWorkspace({
    id: "workspace-1",
    name: "Workspace",
    rootPaths: [root],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    sortOrder: 1,
  });
  await configure(service, "session-1", "pi");
  return { service, calls };
}

function configure(
  service: CocurdexDaemonService,
  sessionId: string,
  agentType: AgentId,
) {
  return service.saveSessionConfiguration({
    id: sessionId,
    workspaceId: "workspace-1",
    title: "Task",
    agentType,
    writeMode: "read-only",
    sessionModeId: null,
  });
}

async function send(
  service: CocurdexDaemonService,
  sessionId: string,
  content: string,
) {
  const message = await service.sendSessionMessage({
    sessionId,
    messageId: crypto.randomUUID(),
    content,
  });
  await vi.waitFor(async () => {
    expect(await service.waitForSessionTurn(sessionId)).toBeNull();
  });
  return message;
}

describe("context transfers", () => {
  it("hands the conversation to a new agent and only the delta back", async () => {
    const { service, calls } = await fixture();
    const first = await send(service, "session-1", "first");
    expect(calls[0]).toMatchObject({ agentType: "pi", content: "first" });

    await service.switchSessionAgent("session-1", "codex");
    const second = await send(service, "session-1", "second");
    expect(calls[1]?.agentType).toBe("codex");
    expect(calls[1]?.content).toMatch(
      /^<cocurdex_context_handoff kind="agent_switch" strategy="full">/,
    );
    expect(calls[1]?.content).toContain("[Assistant (pi)]\npi answer 1");
    expect(calls[1]?.content.endsWith("\n\nsecond")).toBe(true);
    expect(calls[1]?.historyIds).toEqual([second.id]);

    await service.switchSessionAgent("session-1", "pi");
    await send(service, "session-1", "third");
    expect(calls[2]?.content).toContain('strategy="delta"');
    expect(calls[2]?.content).toContain("codex answer 2");
    expect(calls[2]?.content).not.toContain("pi answer 1");
    expect(calls[2]?.historyIds).toContain(first.id);

    await send(service, "session-1", "fourth");
    expect(calls[3]?.content).toBe("fourth");

    const transfers = service.listContextTransfers("session-1");
    expect(
      transfers.map((transfer) => [
        transfer.kind,
        transfer.strategy,
        transfer.sourceAgentTypes,
        transfer.targetAgentType,
      ]),
    ).toEqual([
      ["agent_switch", "full", ["pi"], "codex"],
      ["agent_switch", "delta", ["codex"], "pi"],
    ]);
    expect(
      (await service.state.listMessagesBySessionId("session-1")).find(
        (message) => message.id === second.id,
      )?.content,
    ).toBe("second");
  });

  it("forks a session lazily and resolves the transfer on first send", async () => {
    const { service, calls } = await fixture();
    await send(service, "session-1", "explore");

    const fork = await service.forkSession({ sessionId: "session-1" });
    expect(fork.id).not.toBe("session-1");
    expect(
      (await service.state.listMessagesBySessionId(fork.id)).map(
        (message) => message.content,
      ),
    ).toEqual(["explore", "pi answer 1"]);
    expect(service.listContextTransfers(fork.id)).toMatchObject([
      { kind: "fork", status: "pending", sourceSessionId: "session-1" },
    ]);

    const followUp = await send(service, fork.id, "tangent");
    expect(calls[1]?.content).toMatch(/kind="fork" strategy="full"/);
    expect(calls[1]?.content).toContain("[User]\nexplore");
    expect(calls[1]?.historyIds).toEqual([followUp.id]);
    expect(service.listContextTransfers(fork.id)).toMatchObject([
      {
        kind: "fork",
        status: "consumed",
        targetAgentType: "pi",
        sourceAgentTypes: ["pi"],
        consumedByMessageId: followUp.id,
      },
    ]);
  });
});
