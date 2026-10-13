import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scenarios = [
  "fixture-db",
  "workspace-picker",
  "tooltip-dismiss",
  "pdf-reader",
];
let failed = false;
for (const scenario of scenarios) {
  const entry = fileURLToPath(new URL(`./${scenario}.mjs`, import.meta.url));
  const child = spawn(process.execPath, [entry], {
    stdio: "inherit",
    env: process.env,
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (code !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
