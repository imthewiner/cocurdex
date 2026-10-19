import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requestDaemon } from "@cocurdex/daemon/client";
import { createTempDirs } from "@cocurdex/shared/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bundledDaemonPath,
  type DaemonProcess,
  spawnDaemon,
} from "./helpers/daemon-process";

const tempDirs = createTempDirs();
let daemon: DaemonProcess;

const MARKDOWN = [
  "# Bundled daemon 打包",
  "Synthetic deck",
  "---",
  "## Agenda",
  "- **First** point",
  "- 第二点",
].join("\n");

beforeAll(async () => {
  if (!existsSync(bundledDaemonPath)) {
    throw new Error(
      `Missing ${bundledDaemonPath}; run \`pnpm --filter @cocurdex/desktop prepare:cli\` first`,
    );
  }
  daemon = await spawnDaemon({ entry: "bundled" });
});

afterAll(async () => {
  await daemon?.stop();
  await tempDirs.cleanup();
});

describe("bundled daemon", () => {
  it("exports a deck as PPTX and PDF", async () => {
    const { deck } = await requestDaemon(
      "deck.create",
      { markdown: MARKDOWN },
      daemon.options,
    );
    const dir = tempDirs.createSync("cocu-bundle-");
    for (const [format, signature] of [
      ["pptx", "PK\u0003\u0004"],
      ["pdf", "%PDF"],
    ] as const) {
      const outputPath = path.join(dir, `deck.${format}`);
      const result = await requestDaemon(
        "deck.exportFile",
        { id: deck.id, format, outputPath },
        daemon.options,
      );
      const bytes = await readFile(outputPath);
      expect(result.sizeBytes).toBe(bytes.byteLength);
      expect(bytes.subarray(0, 4).toString("latin1")).toBe(signature);
    }
  });
});
