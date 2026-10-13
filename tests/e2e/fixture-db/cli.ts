import { parseArgs } from "node:util";
import { installFixtureDb } from "./install";

const { values } = parseArgs({
  options: {
    "user-data": { type: "string" },
    "workspace-parent": { type: "string" },
  },
});
const userDataPath = values["user-data"];
const workspaceParent = values["workspace-parent"];
if (!userDataPath || !workspaceParent) {
  process.stderr.write(
    "Usage: node --import tsx fixture-db/cli.ts --user-data <dir> --workspace-parent <dir>\n",
  );
  process.exit(2);
}
const installed = await installFixtureDb({ userDataPath, workspaceParent });
process.stdout.write(`${JSON.stringify(installed)}\n`);
