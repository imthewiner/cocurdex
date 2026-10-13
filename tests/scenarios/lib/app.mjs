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

async function seedWorkspaces(session, workspaces) {
  await session.waitUntil(() => Boolean(window.desktopApi), null, 30_000);
  await session.run(
    async ({ workspaces, productApiModule }) => {
      const { daemonProductApi } = await import(productApiModule);
      for (const [index, workspace] of workspaces.entries()) {
        const now = new Date(Date.now() + index).toISOString();
        await daemonProductApi.saveWorkspace({
          ...workspace,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          sortOrder: (workspaces.length - 1 - index) * 1000,
        });
      }
      return true;
    },
    { workspaces, productApiModule: PRODUCT_API_MODULE },
  );
  await session.reload();
}

function fixtureDbWorkspaces(install) {
  const isPrimary = (workspace) => workspace.id === install.workspaceId;
  return [...install.installedWorkspaces].sort(
    (left, right) => Number(isPrimary(left)) - Number(isPrimary(right)),
  );
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
  let instance;
  try {
    instance = await launchIsolatedInstance({
      prepareUserData: fixtureDb
        ? async (userDataPath) => {
            fixtureDbInstall = await installFixtureDb(
              userDataPath,
              workspaceRoot,
            );
          }
        : undefined,
    });
  } catch (error) {
    await rm(workspaceRoot, { recursive: true, force: true });
    throw error;
  }
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
    try {
      await instance.stop({ keepLog: !passed });
      if (!passed) console.error(`Isolated instance log: ${instance.logPath}`);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  };
  try {
    for (const fixture of fixtures) {
      const target = path.join(workspaceRoot, path.basename(fixture));
      await copyFile(fixture, target);
      files[fixture] = target;
    }
    session = await openAppSession(instance);
    await seedWorkspaces(
      session,
      fixtureDbInstall
        ? fixtureDbWorkspaces(fixtureDbInstall)
        : [
            {
              id: SCENARIO_WORKSPACE_ID,
              name: path.basename(workspaceRoot),
              rootPaths: [workspaceRoot],
            },
          ],
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
