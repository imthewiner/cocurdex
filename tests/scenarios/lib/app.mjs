import { execFile } from "node:child_process";
import { copyFile, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { openAppSession } from "./app-session.mjs";
import { launchIsolatedInstance } from "./instance.mjs";

const E2E_DIR = fileURLToPath(new URL("../../e2e/", import.meta.url));
const FIXTURE_DB_TIMEOUT_MS = 120_000;

const SCENARIO_WORKSPACE_ID = "scenario-workspace";
const PRODUCT_API_MODULE = "/src/lib/product-api.ts";

async function seedWorkspace(session, { id, rootPath }) {
  await session.waitUntil(() => Boolean(window.desktopApi), null, 30_000);
  await session.run(
    async ({ id, rootPath, productApiModule }) => {
      const { daemonProductApi } = await import(productApiModule);
      const now = new Date().toISOString();
      await daemonProductApi.saveWorkspace({
        id,
        name: rootPath.split(/[\\/]/).pop(),
        rootPaths: [rootPath],
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        sortOrder: 0,
      });
      return true;
    },
    { id, rootPath, productApiModule: PRODUCT_API_MODULE },
  );
  await session.reload();
}

async function installFixtureDb(userDataPath, workspaceParent) {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "--import",
      "tsx",
      "fixture-db/cli.ts",
      "--user-data",
      userDataPath,
      "--workspace-parent",
      workspaceParent,
    ],
    { cwd: E2E_DIR, timeout: FIXTURE_DB_TIMEOUT_MS },
  );
  return JSON.parse(stdout.trim().split(/\r?\n/).pop());
}

export async function openScenarioApp(
  { port, url, keep, "fixture-db": fixtureDbArg },
  { fixtures = [], fixtureDb = fixtureDbArg } = {},
) {
  if (port) {
    const session = await openAppSession({ port, url });
    return {
      session,
      isolated: false,
      files: {},
      close: () => session.close(),
    };
  }
  const workspaceRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "cocu-ws-")),
  );
  let fixtureDbInstall = null;
  const instance = await launchIsolatedInstance({
    prepareUserData: fixtureDb
      ? async (userDataPath) => {
          fixtureDbInstall = await installFixtureDb(
            userDataPath,
            workspaceRoot,
          );
        }
      : undefined,
  });
  const files = {};
  let session;
  const close = async ({ passed = false } = {}) => {
    session?.close();
    if (keep) {
      const { pid, port, url, userDataPath, logPath } = instance;
      console.error(
        JSON.stringify({
          pid,
          port,
          url,
          userDataPath,
          logPath,
          workspaceRoot,
        }),
      );
      return;
    }
    await instance.stop({ keepLog: !passed });
    if (!passed) console.error(`Isolated instance log: ${instance.logPath}`);
    await rm(workspaceRoot, { recursive: true, force: true });
  };
  try {
    for (const fixture of fixtures) {
      const target = path.join(workspaceRoot, path.basename(fixture));
      await copyFile(fixture, target);
      files[fixture] = target;
    }
    session = await openAppSession(instance);
    await seedWorkspace(
      session,
      fixtureDbInstall
        ? {
            id: fixtureDbInstall.workspaceId,
            rootPath: fixtureDbInstall.workspacePath,
          }
        : { id: SCENARIO_WORKSPACE_ID, rootPath: workspaceRoot },
    );
    return {
      session,
      isolated: true,
      instance,
      workspaceRoot,
      files,
      fixtureDb: fixtureDbInstall,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
