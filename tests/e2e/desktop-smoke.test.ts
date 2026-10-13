import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { killProcessTree } from "@cocurdex/agent-adapters";
import { requestDaemon } from "@cocurdex/daemon/client";
import { getDaemonMetadataPath } from "@cocurdex/daemon/paths";
import type { DaemonMetadata } from "@cocurdex/rpc";
import { createTempDirs } from "@cocurdex/shared/testing";
import {
  type ElectronApplication,
  _electron as electron,
} from "@playwright/test";
import { afterAll, describe, expect, it } from "vitest";
import { repoRoot, sleep, waitFor } from "./helpers/daemon-process";

const desktopRoot = path.join(repoRoot, "apps", "desktop");
const mainEntry = path.join(desktopRoot, "out", "main", "main.js");
const rendererEntry = path.join(desktopRoot, "out", "renderer", "index.html");
const daemonBundle = path.join(desktopRoot, "resources", "cli", "daemon.cjs");
const electronPackageDir = path.join(desktopRoot, "node_modules", "electron");

function resolveElectronExecutable() {
  const relative = readFileSync(
    path.join(electronPackageDir, "path.txt"),
    "utf8",
  ).trim();
  return path.join(electronPackageDir, "dist", relative);
}

const packaged = process.env.COCURDEX_DESKTOP_PACKAGED === "1";
const releaseRoot = path.join(desktopRoot, "release");
const packagedCandidates: Record<string, string[]> = {
  darwin: [
    path.join(
      releaseRoot,
      `mac-${process.arch}`,
      "Cocurdex.app",
      "Contents",
      "MacOS",
      "Cocurdex",
    ),
    path.join(
      releaseRoot,
      "mac",
      "Cocurdex.app",
      "Contents",
      "MacOS",
      "Cocurdex",
    ),
  ],
  win32: [path.join(releaseRoot, "win-unpacked", "Cocurdex.exe")],
  linux: [path.join(releaseRoot, "linux-unpacked", "Cocurdex")],
};
const tempDirs = createTempDirs();

describe("desktop app boot", () => {
  let userDataPath = "";
  let app: ElectronApplication | undefined;
  let daemonPid: number | undefined;

  afterAll(async () => {
    const failures: unknown[] = [];
    try {
      await app?.close();
    } catch (error) {
      failures.push(error);
    }
    if (daemonPid) {
      try {
        process.kill(daemonPid, 0);
        await killProcessTree(daemonPid);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH")
          failures.push(error);
      }
    }
    await tempDirs.cleanup();
    if (failures.length)
      throw new AggregateError(failures, "Desktop cleanup failed");
  });

  it("boots a window and spawns a live daemon", async () => {
    const executablePath = packaged
      ? packagedCandidates[process.platform]?.find((candidate) =>
          existsSync(candidate),
        )
      : resolveElectronExecutable();
    if (!executablePath) throw new Error("Missing packaged desktop executable");
    if (!packaged) {
      for (const required of [mainEntry, rendererEntry, daemonBundle]) {
        if (!existsSync(required))
          throw new Error(`Missing desktop build output: ${required}`);
      }
    }
    userDataPath = tempDirs.createSync("cocu-smoke-");
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    env.COCURDEX_USER_DATA_PATH = userDataPath;
    env.NO_COLOR = "1";
    env.TZ = "UTC";
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      executablePath,
      args: packaged ? ["--no-sandbox"] : [desktopRoot, "--no-sandbox"],
      env,
    });

    const page = await app.firstWindow();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const metadataPath = getDaemonMetadataPath(userDataPath);
    await waitFor(() => existsSync(metadataPath), 30_000);
    const metadata = JSON.parse(
      readFileSync(metadataPath, "utf8"),
    ) as DaemonMetadata;
    daemonPid = metadata.pid;
    expect(metadata.pid).toBeGreaterThan(0);
    expect(metadata.token).toBeTruthy();

    const status = await requestDaemon("daemon.status", { metadata });
    expect(status.pid).toBe(metadata.pid);
    expect(status.startedAt).toBe(metadata.startedAt);

    const title = "Renderer WebSocket note ".repeat(4);
    const window = app.windows().find((candidate) => !candidate.isClosed());
    if (!window) throw new Error("No open desktop window");
    if (window !== page)
      window.on("pageerror", (error) => pageErrors.push(error.message));
    const created = await window.evaluate(async (noteTitle) => {
      const api = (
        globalThis as unknown as {
          desktopApi: {
            getDaemonConnection(): Promise<{
              webSocketUrl: string;
              token: string;
            }>;
          };
        }
      ).desktopApi;
      const { webSocketUrl, token } = await api.getDaemonConnection();
      const socket = new WebSocket(webSocketUrl, [
        "cocurdex.v1",
        `cocurdex.token.${token}`,
      ]);
      const id = crypto.randomUUID();
      return new Promise<unknown>((resolve, reject) => {
        socket.onerror = () => reject(new Error("WebSocket failed"));
        socket.onopen = () =>
          socket.send(
            JSON.stringify({
              id,
              method: "note.create",
              params: { title: noteTitle },
              token,
            }),
          );
        socket.onmessage = (event) => {
          const response = JSON.parse(String(event.data));
          if (response.id !== id) return;
          socket.close();
          resolve(response.result);
        };
      });
    }, title);
    expect(created).toMatchObject({ title: title.trim() });
    const afterWebSocket = await requestDaemon("daemon.status", { metadata });
    expect(afterWebSocket.pid).toBe(metadata.pid);

    await window.locator("body").waitFor({ state: "visible" });
    expect(await window.locator("body").innerText()).not.toBe("");
    await sleep(500);
    const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
    if (artifacts) {
      await mkdir(artifacts, { recursive: true });
      await window.screenshot({
        path: path.join(artifacts, "desktop-smoke.png"),
      });
      await writeFile(
        path.join(artifacts, "desktop-smoke.json"),
        JSON.stringify({ packaged, pageErrors, daemonPid }, null, 2),
      );
    }
    expect(pageErrors).toEqual([]);
  });
});
