import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const DESKTOP_DIR = fileURLToPath(
  new URL("../../../apps/desktop/", import.meta.url),
);
const REPO_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const BUNDLED_DAEMON = path.join(DESKTOP_DIR, "resources", "cli", "daemon.cjs");
const DAEMON_SOURCE_ROOTS = ["packages", path.join("apps", "cli")];
const RENDERER_URL_PATTERN = /Local:\s+(http:\/\/localhost:\d+\/)/;
const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;
const STOP_TIMEOUT_MS = 10_000;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function newestSourceMtime() {
  let newest = 0;
  for (const root of DAEMON_SOURCE_ROOTS) {
    const rootDir = path.join(REPO_DIR, root);
    const sourceDirs =
      root === "packages"
        ? readdirSync(rootDir).map((name) => path.join(rootDir, name, "src"))
        : [path.join(rootDir, "src")];
    for (const dir of sourceDirs.filter((candidate) => existsSync(candidate))) {
      for (const file of readdirSync(dir, { recursive: true })) {
        newest = Math.max(newest, statSync(path.join(dir, file)).mtimeMs);
      }
    }
  }
  return newest;
}

let bundledDaemonCheck = null;

function ensureBundledDaemon() {
  bundledDaemonCheck ??= Promise.resolve().then(() => {
    const builtAt = existsSync(BUNDLED_DAEMON)
      ? statSync(BUNDLED_DAEMON).mtimeMs
      : 0;
    if (builtAt >= newestSourceMtime()) return;
    const result = spawnSync(
      process.execPath,
      [path.join(DESKTOP_DIR, "scripts", "build-cli.mjs")],
      { cwd: DESKTOP_DIR, stdio: ["ignore", "ignore", "inherit"] },
    );
    if (result.status !== 0) {
      throw new Error(`Bundled daemon rebuild failed (${result.status})`);
    }
  });
  return bundledDaemonCheck;
}

function electronViteBin() {
  const require = createRequire(path.join(DESKTOP_DIR, "package.json"));
  const manifestPath = require.resolve("electron-vite/package.json");
  const manifest = require(manifestPath);
  const bin =
    typeof manifest.bin === "string"
      ? manifest.bin
      : manifest.bin["electron-vite"];
  return path.join(path.dirname(manifestPath), bin);
}

function descendantPids(rootPid) {
  const result = spawnSync("ps", ["-axo", "pid=,ppid="], {
    encoding: "utf8",
  });
  const children = new Map();
  for (const line of result.stdout.split(/\r?\n/)) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!pid) continue;
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  const found = [];
  const queue = [rootPid];
  while (queue.length > 0) {
    const pid = queue.shift();
    for (const child of children.get(pid) ?? []) {
      found.push(child);
      queue.push(child);
    }
  }
  return found;
}

function treePids(rootPid) {
  if (process.platform === "win32") return [rootPid];
  return [rootPid, ...descendantPids(rootPid)];
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pids) {
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  while (pids.some(isRunning) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  for (const pid of pids.filter(isRunning)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
}

function killTree(rootPid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(rootPid), "/T", "/F"]);
    return;
  }
  for (const pid of [rootPid, ...descendantPids(rootPid)].reverse()) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
}

function waitForRendererUrl(child, logStream) {
  return new Promise((resolve, reject) => {
    let buffered = "";
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for the renderer dev server")),
      STARTUP_TIMEOUT_MS,
    );
    let resolved = false;
    const onData = (chunk) => {
      logStream.write(chunk);
      if (resolved) return;
      buffered += stripVTControlCharacters(chunk.toString("utf8"));
      const match = RENDERER_URL_PATTERN.exec(buffered);
      if (match) {
        resolved = true;
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => logStream.write(chunk));
    child.once("exit", (code) => {
      if (resolved) return;
      clearTimeout(timer);
      reject(new Error(`electron-vite dev exited early with code ${code}`));
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function waitForTarget(port, url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      if (targets.some((target) => target.url === url)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for CDP target ${url} on ${port}`);
}

export async function stopIsolatedInstance(pid, userDataPath) {
  const tree = treePids(pid);
  killTree(pid);
  await waitForExit(tree);
  await rm(userDataPath, { recursive: true, force: true });
}

export async function launchIsolatedInstance({ prepareUserData } = {}) {
  await ensureBundledDaemon();
  const viteBin = electronViteBin();
  const port = await freePort();
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "cocu-"));
  try {
    await prepareUserData?.(userDataPath);
  } catch (error) {
    await rm(userDataPath, { recursive: true, force: true });
    throw error;
  }
  const logPath = `${userDataPath}.log`;
  const logStream = createWriteStream(logPath);
  const child = spawn(process.execPath, [viteBin, "dev"], {
    cwd: DESKTOP_DIR,
    env: {
      ...process.env,
      COCURDEX_USER_DATA_PATH: userDataPath,
      COCURDEX_REMOTE_DEBUGGING_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = async ({ keepLog = false } = {}) => {
    child.stdout.removeAllListeners("data");
    child.stderr.removeAllListeners("data");
    logStream.end();
    await stopIsolatedInstance(child.pid, userDataPath);
    const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
    if (keepLog && artifacts) {
      await mkdir(artifacts, { recursive: true });
      await copyFile(logPath, path.join(artifacts, path.basename(logPath)));
    }
    if (!keepLog) await rm(logPath, { force: true });
  };
  try {
    const url = await waitForRendererUrl(child, logStream);
    await waitForTarget(port, url);
    return {
      pid: child.pid,
      port: String(port),
      url,
      userDataPath,
      logPath,
      stop,
    };
  } catch (error) {
    await stop({ keepLog: true });
    throw new Error(
      `${error instanceof Error ? error.message : error} (log: ${logPath})`,
    );
  }
}
