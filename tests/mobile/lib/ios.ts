import { existsSync } from "node:fs";
import path from "node:path";
import { runCommand } from "./command";
import type { MobileTarget } from "./target";

const PREFERRED_DEVICE_TYPE = "iPhone 16 Pro";

interface SimctlRuntime {
  identifier: string;
  platform: string;
  isAvailable: boolean;
  version: string;
  supportedDeviceTypes: { identifier: string; name: string }[];
}

function compareVersions(left: string, right: string) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

async function latestIosRuntime() {
  const output = await runCommand("xcrun", [
    "simctl",
    "list",
    "--json",
    "runtimes",
  ]);
  const { runtimes } = JSON.parse(output) as { runtimes: SimctlRuntime[] };
  const runtime = runtimes
    .filter(
      (candidate) => candidate.platform === "iOS" && candidate.isAvailable,
    )
    .sort((left, right) => compareVersions(right.version, left.version))[0];
  if (!runtime) throw new Error("No available iOS simulator runtime");
  const deviceType =
    runtime.supportedDeviceTypes.find(
      (type) => type.name === PREFERRED_DEVICE_TYPE,
    ) ??
    runtime.supportedDeviceTypes.find((type) => type.name.startsWith("iPhone"));
  if (!deviceType) throw new Error(`No iPhone type for ${runtime.identifier}`);
  return { runtime: runtime.identifier, deviceType: deviceType.identifier };
}

export async function buildIosApp(mobileDir: string) {
  await runCommand("pnpm", ["exec", "expo", "prebuild", "--platform", "ios"], {
    cwd: mobileDir,
    env: { ...process.env, CI: "1" },
    inherit: true,
  });
  await runCommand(
    "xcodebuild",
    [
      "-workspace",
      "ios/Cocurdex.xcworkspace",
      "-scheme",
      "Cocurdex",
      "-configuration",
      "Release",
      "-sdk",
      "iphonesimulator",
      "-derivedDataPath",
      "ios/build",
      "build",
    ],
    { cwd: mobileDir, inherit: true },
  );
}

export function iosAppPath(mobileDir: string) {
  return path.join(
    mobileDir,
    "ios/build/Build/Products/Release-iphonesimulator/Cocurdex.app",
  );
}

export async function startIosTarget(mobileDir: string): Promise<MobileTarget> {
  const appPath = iosAppPath(mobileDir);
  if (!existsSync(appPath)) {
    throw new Error(`Missing ${appPath}; run with --build first`);
  }
  const { runtime, deviceType } = await latestIosRuntime();
  const udid = (
    await runCommand("xcrun", [
      "simctl",
      "create",
      `cocurdex-e2e-${process.pid}`,
      deviceType,
      runtime,
    ])
  ).trim();
  const stop = async () => {
    await runCommand("xcrun", ["simctl", "shutdown", udid]).catch(() => "");
    await runCommand("xcrun", ["simctl", "delete", udid]);
  };
  try {
    await runCommand("xcrun", ["simctl", "boot", udid]);
    await runCommand("xcrun", ["simctl", "bootstatus", udid, "-b"]);
    await runCommand("xcrun", ["simctl", "install", udid, appPath]);
    return {
      deviceId: udid,
      hostAlias: null,
      setAppearance: async (appearance) => {
        await runCommand("xcrun", [
          "simctl",
          "ui",
          udid,
          "appearance",
          appearance,
        ]);
      },
      resetState: async () => {
        await runCommand("xcrun", ["simctl", "keychain", udid, "reset"]);
      },
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
