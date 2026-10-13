import { mkdtempSync } from "node:fs";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DATABASE_FILENAME } from "@cocurdex/daemon/paths";
import {
  buildFixtureDb,
  FIXTURE_MANIFEST_FILENAME,
  type FixtureManifest,
} from "./build";
import { materializeFixtureWorkspace } from "./workspace";

export interface InstalledFixture extends FixtureManifest {
  workspacePath: string;
}

export async function installFixtureDb(input: {
  userDataPath: string;
  workspaceParent: string;
}): Promise<InstalledFixture> {
  const built = mkdtempSync(path.join(tmpdir(), "cfx-out-"));
  try {
    await buildFixtureDb(built);
    const manifest = JSON.parse(
      await readFile(path.join(built, FIXTURE_MANIFEST_FILENAME), "utf8"),
    ) as FixtureManifest;
    await mkdir(input.userDataPath, { recursive: true });
    await copyFile(
      path.join(built, DATABASE_FILENAME),
      path.join(input.userDataPath, DATABASE_FILENAME),
    );
    const workspacePath = await materializeFixtureWorkspace(
      path.join(input.workspaceParent, manifest.workspaceName),
    );
    return { ...manifest, workspacePath };
  } finally {
    await rm(built, { recursive: true, force: true });
  }
}
