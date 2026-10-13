import { requestDaemon, subscribeDaemonEvents } from "@cocurdex/daemon/client";
import type { CocurdexDaemonEvent, SessionRecord } from "@cocurdex/shared";
import { describe, expect, it } from "vitest";
import { saveStubProvider } from "./helpers/chat-session";
import { runCli } from "./helpers/cli";
import { spawnDaemon, waitFor } from "./helpers/daemon-process";
import { createGitRepository } from "./helpers/git-repository";
import { startStubLlmServer } from "./helpers/llm-stub";

function completedRun(events: CocurdexDaemonEvent[], sessionId: string) {
  return events.some(
    (event) =>
      event.type === "run.updated" &&
      event.sessionId === sessionId &&
      event.run.status === "completed",
  );
}

describe("session fork over the real socket", () => {
  it("forks through the CLI and hands the source transcript to the first run", async () => {
    const stub = await startStubLlmServer();
    const repo = await createGitRepository();
    const daemon = await spawnDaemon();
    const events: CocurdexDaemonEvent[] = [];
    const subscription = await subscribeDaemonEvents(
      (event) => events.push(event),
      daemon.options,
    );
    try {
      const now = new Date().toISOString();
      await requestDaemon(
        "workspace.save",
        {
          workspace: {
            id: "e2e-workspace",
            name: "e2e-workspace",
            rootPaths: [repo.path],
            createdAt: now,
            updatedAt: now,
            lastOpenedAt: now,
            sortOrder: 0,
          },
        },
        daemon.options,
      );
      const source = await requestDaemon(
        "session.configure",
        {
          id: crypto.randomUUID(),
          workspaceId: "e2e-workspace",
          title: "Source",
          agentType: "pi",
          writeMode: "read-only",
          sessionModeId: null,
          providerSnapshot: await saveStubProvider(daemon, stub),
        },
        daemon.options,
      );
      stub.plan = { kind: "stream", chunks: ["Found the parser"] };
      await requestDaemon(
        "session.send",
        {
          sessionId: source.id,
          messageId: crypto.randomUUID(),
          content: "Where is the parser?",
        },
        daemon.options,
      );
      await waitFor(() => completedRun(events, source.id));

      const forked = await runCli(["session", "fork", source.id, "--json"], {
        userDataPath: daemon.userDataPath,
      });
      expect(forked.stderr).toBe("");
      const fork = JSON.parse(forked.stdout) as SessionRecord;
      expect(fork.id).not.toBe(source.id);

      const pending = await runCli(["session", "handoffs", fork.id], {
        userDataPath: daemon.userDataPath,
      });
      expect(pending.stdout).toMatch(/fork\s+pending/);

      stub.plan = { kind: "stream", chunks: ["Tangent done"] };
      await requestDaemon(
        "session.send",
        {
          sessionId: fork.id,
          messageId: crypto.randomUUID(),
          content: "Try another approach",
        },
        daemon.options,
      );
      await waitFor(() => completedRun(events, fork.id));
      const body =
        stub.requests
          .map((request) => JSON.stringify(request.body))
          .find((text) => text.includes("Try another approach")) ?? "";
      expect(body).toMatch(/cocurdex_context_handoff kind=\\*"fork/);
      expect(body).toContain("Where is the parser?");
      expect(body).toContain("Found the parser");

      const transfers = await requestDaemon(
        "session.contextTransfers",
        { sessionId: fork.id },
        daemon.options,
      );
      expect(transfers).toMatchObject([
        {
          kind: "fork",
          status: "consumed",
          sourceSessionId: source.id,
          targetAgentType: "pi",
          coveredMessageCount: 2,
        },
      ]);
    } finally {
      subscription.close();
      await daemon.dispose();
      await stub.close();
      await repo.dispose();
    }
  });
});
