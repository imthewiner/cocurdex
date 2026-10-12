import { copyFile, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openAppSession } from "./app-session.mjs";
import { launchIsolatedInstance } from "./instance.mjs";

const SCENARIO_WORKSPACE_ID = "scenario-workspace";
const PRODUCT_API_MODULE = "/src/lib/product-api.ts";

async function seedWorkspace(session, rootPath) {
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
    {
      id: SCENARIO_WORKSPACE_ID,
      rootPath,
      productApiModule: PRODUCT_API_MODULE,
    },
  );
  await session.reload();
}

export async function openScenarioApp(
  { port, url, keep },
  { fixtures = [] } = {},
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
  const instance = await launchIsolatedInstance();
  const workspaceRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "cocu-ws-")),
  );
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
    await seedWorkspace(session, workspaceRoot);
    return { session, isolated: true, instance, workspaceRoot, files, close };
  } catch (error) {
    await close();
    throw error;
  }
}
