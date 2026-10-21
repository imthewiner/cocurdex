import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import {
  hoverUntilTooltipOpens,
  nodeCenter,
  readOpenTooltip,
} from "./lib/hover.mjs";
import { waitForRole } from "./lib/locate.mjs";

const SESSION_TITLE = "Add percentage discount codes";
const UI_TIMEOUT_MS = 30_000;
const EXACT_TIME = /\d{1,2}:\d{2}:\d{2}/;

const args = readScenarioArgs();

runScenario("sidebar-preview", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    const [row] = await waitForRole(
      session,
      { role: "button", name: new RegExp(`^${SESSION_TITLE}`) },
      UI_TIMEOUT_MS,
    );
    return { point: await nodeCenter(session, row.backendNodeId) };
  },
  steps: [
    [
      "session preview shows the title alone and the activity time last",
      async ({ session, point }) => {
        await hoverUntilTooltipOpens(session, point, UI_TIMEOUT_MS);
        const preview = await session.run(readOpenTooltip);
        const [titleLine] = preview.lines;
        const timeLine = preview.lines.at(-1);
        check(titleLine === SESSION_TITLE, "title shares its line", preview);
        check(EXACT_TIME.test(timeLine), "no exact activity time", preview);
        check(timeLine.includes(" · "), "no relative age", preview);
        return preview;
      },
    ],
    [
      "renderer has no errors",
      async ({ session }) => {
        const errors = await session.run(() => window.__scenario.errors);
        check(errors.length === 0, "renderer errors", errors);
        return {};
      },
    ],
  ],
  teardown: async () => ({}),
});
