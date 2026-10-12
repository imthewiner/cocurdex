import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TerminalDaemonEvent } from "@cocurdex/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalService } from "./terminal-service";

let workspaceRoot: string;
let service: TerminalService;
const events: TerminalDaemonEvent[] = [];

function spawnTerminal(terminalId: string, cwd = workspaceRoot) {
  return service.spawn({
    terminalId,
    workspaceId: "workspace-1",
    cwd,
    cols: 80,
    rows: 24,
  });
}

beforeEach(async () => {
  workspaceRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "cd-terminal-")),
  );
  events.length = 0;
  service = new TerminalService({
    emit: (event) => events.push(event),
    listWorkspaceRootPaths: async () => [workspaceRoot],
    detachedGraceMs: 20,
  });
});

afterEach(async () => {
  await service.dispose();
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe("TerminalService", () => {
  it("rejects a working directory outside the home directory and workspace roots", async () => {
    await expect(
      spawnTerminal("terminal-1", path.join(workspaceRoot, "nested")),
    ).rejects.toThrow("not a registered workspace root");
  });

  it("reattaches to the running shell when the same terminal spawns again", async () => {
    const release = service.retainClient();
    const first = await spawnTerminal("terminal-1");
    const second = await spawnTerminal("terminal-1");

    expect(second.pid).toBe(first.pid);
    expect(service.activeCount).toBe(1);
    release();
  });

  it("stops terminals once no client has been attached for the grace period", async () => {
    const release = service.retainClient();
    await spawnTerminal("terminal-1");
    release();

    await vi.waitFor(() => expect(service.activeCount).toBe(0));
  });

  it("keeps terminals while a client reattaches within the grace period", async () => {
    const release = service.retainClient();
    await spawnTerminal("terminal-1");
    release();
    const reattached = service.retainClient();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(service.activeCount).toBe(1);
    reattached();
  });
});
