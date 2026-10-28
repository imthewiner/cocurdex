import assert from "node:assert/strict";
import path from "node:path";
import { parseArgs } from "node:util";
import { runCommand, waitUntil } from "./lib/command";

const { values } = parseArgs({
  options: {
    serial: { type: "string" },
    row: { type: "string" },
    screenshot: { type: "string" },
  },
});
assert(
  values.serial && values.row,
  "Pass --serial and --row with a visible row selector",
);
const serial = values.serial;
const row = values.row;
const device = path.resolve(
  import.meta.dirname,
  `node_modules/.bin/agent-device${process.platform === "win32" ? ".cmd" : ""}`,
);
const target = ["--platform", "android", "--serial", serial];
const adb = (args: string[]) => runCommand("adb", ["-s", serial, ...args]);
const agent = (...args: string[]) => runCommand(device, [...args, ...target]);
async function rowTop() {
  const result = JSON.parse(await agent("get", "attrs", row, "--json"));
  assert(
    result.success && result.data.node.visibleToUser,
    "Tracked row must be visible",
  );
  return result.data.node.rect.y as number;
}
const status = await adb(["shell", "cmd", "wifi", "status"]);
assert(status.includes("Wifi is enabled"), "Start with Wi-Fi enabled");
const before = await rowTop();
let offline = before;
try {
  await adb(["shell", "input", "keyevent", "KEYCODE_HOME"]);
  await adb(["shell", "svc", "wifi", "disable"]);
  await agent("open", "dev.cocurdex.mobile");
  await agent("wait", 'id="session-offline"', "15000");
  offline = await rowTop();
  if (values.screenshot) {
    const remote = `/sdcard/cocurdex-list-resume-${process.pid}.png`;
    try {
      await adb(["shell", "screencap", "-p", remote]);
      await adb(["pull", remote, path.resolve(values.screenshot)]);
    } finally {
      await adb(["shell", "rm", "-f", remote]);
    }
  }
} finally {
  await adb(["shell", "svc", "wifi", "enable"]);
}
await agent("wait", "absent", 'id="session-offline"', "20000");
await waitUntil(
  async () => (await rowTop()) === before,
  5000,
  "row position after reconnect",
);
console.log(JSON.stringify({ before, offline, delta: offline - before }));
assert.equal(offline, before, "Connection status must not move session rows");
