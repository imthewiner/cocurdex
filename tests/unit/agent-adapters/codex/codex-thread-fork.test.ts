import type { CodexClientLease } from "@cocurdex/agent-adapters/internal/codex/codex-app-server-pool";
import { forkCodexProviderSession } from "@cocurdex/agent-adapters/internal/codex/codex-thread-fork";
import { describe, expect, it, vi } from "vitest";

describe("forkCodexProviderSession", () => {
  it("forks the thread on the app-server and releases the lease", async () => {
    const forkThread = vi.fn(async () => ({ thread: { id: "thread-2" } }));
    const release = vi.fn();
    const lease = {
      client: { forkThread },
      release,
    } as unknown as CodexClientLease;

    const record = await forkCodexProviderSession(
      {
        source: {
          sessionId: "source",
          providerSessionId: "thread-1",
          providerStateJson: '{"adapter":"codex","threadId":"thread-1"}',
          providerVersion: null,
          resumable: true,
          updatedAt: "2026-10-12T00:00:00.000Z",
        },
        targetSessionId: "fork",
        workspaceRootPath: "/repo",
      },
      () => lease,
    );

    expect(forkThread).toHaveBeenCalledWith({
      threadId: "thread-1",
      cwd: "/repo",
      excludeTurns: true,
    });
    expect(record).toMatchObject({
      sessionId: "fork",
      providerSessionId: "thread-2",
      resumable: true,
    });
    expect(JSON.parse(record.providerStateJson)).toMatchObject({
      adapter: "codex",
      threadId: "thread-2",
    });
    expect(release).toHaveBeenCalledOnce();
  });
});
