import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { requestDaemon } from "@cocurdex/daemon/client";
import { createTempDirs } from "@cocurdex/shared/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DaemonProcess, spawnDaemon } from "./helpers/daemon-process";
import {
  createGitRepository,
  type GitRepositoryFixture,
} from "./helpers/git-repository";

const tempDirs = createTempDirs();

function directChildren(
  entries: { kind: string; relativePath: string }[],
  directory: string,
) {
  return entries
    .filter(
      (entry) =>
        path.posix.dirname(entry.relativePath) === directory &&
        entry.relativePath !== directory,
    )
    .map(({ kind, relativePath }) => ({ kind, relativePath }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

describe("workspace.listDirectory over a real daemon", () => {
  let daemon: DaemonProcess;
  let repo: GitRepositoryFixture;
  let rootPath: string;

  beforeAll(async () => {
    daemon = await spawnDaemon();
    repo = await createGitRepository();
    rootPath = await realpath(repo.path);
    await mkdir(path.join(rootPath, "src", "auth", "nested"), {
      recursive: true,
    });
    await writeFile(path.join(rootPath, "src", "auth", "token.ts"), "x\n");
    await writeFile(
      path.join(rootPath, "src", "auth", "nested", "a.ts"),
      "x\n",
    );
    await writeFile(path.join(rootPath, "src", "index.ts"), "x\n");
    const now = "2026-10-21T00:00:00.000Z";
    await requestDaemon(
      "workspace.save",
      {
        workspace: {
          id: "files-workspace",
          name: "acme-files",
          rootPaths: [rootPath],
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          sortOrder: 0,
        },
      },
      daemon.options,
    );
  });

  afterAll(async () => {
    await daemon.dispose();
    await repo.dispose();
    await tempDirs.cleanup();
  });

  it("lists one level that matches the full workspace listing", async () => {
    const all = await requestDaemon(
      "workspace.listFiles",
      { rootPath },
      daemon.options,
    );
    for (const directory of [".", "src", "src/auth"]) {
      const children = await requestDaemon(
        "workspace.listDirectory",
        { rootPath, relativePath: directory },
        daemon.options,
      );
      expect(
        children
          .map(({ kind, relativePath }) => ({ kind, relativePath }))
          .sort((left, right) =>
            left.relativePath.localeCompare(right.relativePath),
          ),
      ).toEqual(directChildren(all, directory));
    }
  });

  it("returns nothing for a root outside every workspace", async () => {
    const outside = await realpath(tempDirs.createSync("cocu-outside-"));
    await mkdir(path.join(outside, "private"));
    await writeFile(path.join(outside, "private", "key.txt"), "x\n");

    const children = await requestDaemon(
      "workspace.listDirectory",
      { rootPath: outside, relativePath: "private" },
      daemon.options,
    );
    expect(children).toEqual([]);
  });

  it("rejects a relative path that leaves the root", async () => {
    await expect(
      requestDaemon(
        "workspace.listDirectory",
        { rootPath, relativePath: "../.." },
        daemon.options,
      ),
    ).rejects.toThrow();
  });
});
