import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTempDirs } from "@cocurdex/shared/testing";
import { afterAll, describe, expect, it } from "vitest";
import { createWorkspaceScanPolicy } from "./scan-roots";
import type { DaemonState } from "./state";

const tempDirs = createTempDirs();

afterAll(() => tempDirs.cleanup());

function stateWithRoots(workspaceRootPaths: string[]) {
  return {
    listWorkspaces: async () =>
      workspaceRootPaths.map((rootPath) => ({ rootPaths: [rootPath] })),
    listSessions: async () => [],
    listArchivedSessions: async () => [],
  } as unknown as DaemonState;
}

describe("workspace scan policy", () => {
  it("allows files inside a registered workspace and rejects others", async () => {
    const workspaceRootPath = await tempDirs.create("cocurdex-scan-");
    const filePath = path.join(workspaceRootPath, "src", "app.ts");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "x", "utf8");

    const policy = createWorkspaceScanPolicy(
      stateWithRoots([workspaceRootPath]),
    );

    await expect(policy.canAccessFile(filePath)).resolves.toBe(true);
    await expect(policy.canAccessFile("/etc/hosts")).resolves.toBe(false);
    await expect(policy.canScan(workspaceRootPath)).resolves.toBe(true);
    await expect(
      policy.canScan(path.join(workspaceRootPath, "src")),
    ).resolves.toBe(false);
  });

  it("rejects files escaping the workspace through a symlink", async () => {
    const workspaceRootPath = await tempDirs.create("cocurdex-scan-");
    const outsideDir = await tempDirs.create("cocurdex-outside-");
    const escaped = path.join(outsideDir, "secret.txt");
    await writeFile(escaped, "x", "utf8");
    await symlink(outsideDir, path.join(workspaceRootPath, "linked"), "dir");

    const policy = createWorkspaceScanPolicy(
      stateWithRoots([workspaceRootPath]),
    );

    await expect(
      policy.canAccessFile(
        path.join(workspaceRootPath, "linked", "secret.txt"),
      ),
    ).resolves.toBe(false);
  });
});
