import path from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { parseHostPairingLink } from "@cocurdex/shared";
import { createTempDirs } from "@cocurdex/shared/testing";
import { buildAndroidApp, startAndroidTarget } from "./lib/android";
import { runCommand } from "./lib/command";
import { startPairingDaemon } from "./lib/daemon";
import { buildIosApp, startIosTarget } from "./lib/ios";

const mobileDir = path.resolve(import.meta.dirname, "../../apps/mobile");
const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    platform: { type: "string", default: "ios" },
    avd: { type: "string" },
    build: { type: "boolean", default: false },
    dev: { type: "boolean", default: false },
  },
});
const platform = values.platform === "android" ? "android" : "ios";

function pairingDeepLink(pairingLink: string) {
  const parsed = parseHostPairingLink(pairingLink);
  if (!parsed) throw new Error(`Unexpected pairing link: ${pairingLink}`);
  const query = new URLSearchParams({
    host: parsed.baseUrl,
    code: parsed.code,
  });
  return `cocurdex://pair?${query}`;
}

function untilInterrupted() {
  return new Promise<void>((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });
}

async function main() {
  if (values.build) {
    await (platform === "ios"
      ? buildIosApp(mobileDir)
      : buildAndroidApp(mobileDir));
  }
  const tempDirs = createTempDirs();
  const daemon = await startPairingDaemon(platform, tempDirs);
  try {
    const target =
      platform === "ios"
        ? await startIosTarget(mobileDir, { install: !values.dev })
        : await startAndroidTarget(mobileDir, values.avd, {
            visible: true,
            install: !values.dev,
          });
    try {
      if (platform === "ios") {
        await runCommand("open", ["-b", "com.apple.dt.Devices"]);
      }
      const printPairingLink = async () => {
        const pairingLink = await daemon.createPairingLink();
        process.stdout.write(
          `${JSON.stringify({
            platform,
            deviceId: target.deviceId,
            pairingLink,
            deepLink: pairingDeepLink(pairingLink),
          })}\n`,
        );
      };
      if (!values.dev) await target.launchApp();
      await printPairingLink();
      const input = createInterface({ input: process.stdin });
      input.on("line", () => void printPairingLink());
      await untilInterrupted();
      input.close();
    } finally {
      await target.stop();
    }
  } finally {
    await daemon.dispose();
    tempDirs.cleanup();
  }
}

await main();
