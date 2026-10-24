import path from "node:path";
import { parseArgs } from "node:util";
import { createTempDirs } from "@cocurdex/shared/testing";
import { androidSdk, buildAndroidApp, startAndroidTarget } from "./lib/android";
import { runCommand } from "./lib/command";
import { startPairingDaemon } from "./lib/daemon";
import { buildIosApp, startIosTarget } from "./lib/ios";
import type { Appearance, MobileTarget } from "./lib/target";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const mobileDir = path.join(repoRoot, "apps/mobile");
const flowsDir = path.join(import.meta.dirname, "flows");
const APPEARANCES: Appearance[] = ["light", "dark"];

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    platform: { type: "string" },
    build: { type: "boolean", default: false },
    avd: { type: "string" },
    keep: { type: "boolean", default: false },
  },
});

const platform =
  values.platform ?? (process.platform === "darwin" ? "ios" : "android");
if (platform !== "ios" && platform !== "android") {
  throw new Error(`--platform must be ios or android, not ${platform}`);
}
if (platform === "ios" && process.platform !== "darwin") {
  throw new Error("iOS runs need macOS with Xcode");
}

async function runFlow(
  target: MobileTarget,
  flow: string,
  env: Record<string, string>,
  outputDir: string,
) {
  const envArgs = Object.entries(env).flatMap(([key, value]) => [
    "-e",
    `${key}=${value}`,
  ]);
  await runCommand(
    "maestro",
    [
      "--device",
      target.deviceId,
      "test",
      ...envArgs,
      "--test-output-dir",
      outputDir,
      path.join(flowsDir, flow),
    ],
    {
      inherit: true,
      env:
        platform === "android"
          ? { ...process.env, ANDROID_HOME: androidSdk() }
          : process.env,
    },
  );
}

async function main() {
  await runCommand("maestro", ["--version"]).catch(() => {
    throw new Error("Maestro CLI is missing; install it and Java 17+");
  });
  if (values.build) {
    await (platform === "ios"
      ? buildIosApp(mobileDir)
      : buildAndroidApp(mobileDir));
  }
  const tempDirs = createTempDirs();
  const outputRoot = tempDirs.createSync("cocu-mobile-");
  const target =
    platform === "ios"
      ? await startIosTarget(mobileDir)
      : await startAndroidTarget(mobileDir, values.avd);
  try {
    const daemon = await startPairingDaemon(target.hostAlias);
    try {
      for (const appearance of APPEARANCES) {
        await target.resetState();
        await target.setAppearance(appearance);
        await runFlow(
          target,
          "pairing.yaml",
          {
            PAIRING_LINK: await daemon.createPairingLink(),
            HOST_ADDRESS: daemon.hostAddress,
          },
          path.join(outputRoot, appearance),
        );
      }
      const devices = await daemon.pairedDevices();
      if (devices.length !== APPEARANCES.length) {
        throw new Error(
          `Expected ${APPEARANCES.length} paired devices, daemon has ${devices.length}`,
        );
      }
    } finally {
      await daemon.dispose();
    }
    process.stdout.write(
      `${JSON.stringify({ platform, ok: true, screenshots: values.keep ? outputRoot : null })}\n`,
    );
  } finally {
    await target.stop();
    if (!values.keep) await tempDirs.cleanup();
  }
}

await main();
