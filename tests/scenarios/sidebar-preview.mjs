import { setTimeout as delay } from "node:timers/promises";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { waitForRole } from "./lib/locate.mjs";

const SESSION_TITLE = "Add percentage discount codes";
const UI_TIMEOUT_MS = 30_000;
const TOOLTIP_DELAY_MS = 900;
const EXACT_TIME = /\d{1,2}:\d{2}:\d{2}/;

const args = readScenarioArgs();

async function rowCenter(session, backendNodeId) {
  await session.send("DOM.getDocument", { depth: 0 });
  await session.send("DOM.scrollIntoViewIfNeeded", { backendNodeId });
  const { model } = await session.send("DOM.getBoxModel", { backendNodeId });
  const [left, top, , , right, bottom] = model.border;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

async function hoverUntilPreviewOpens(session, point) {
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x + 400,
    y: point.y,
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...point,
  });
  await delay(TOOLTIP_DELAY_MS);
  await session.waitUntil(
    () =>
      document
        .querySelector('[data-slot="tooltip-content"]')
        ?.hasAttribute("data-open") ?? false,
    null,
    UI_TIMEOUT_MS,
  );
}

function readPreview() {
  const popup = document.querySelector('[data-slot="tooltip-content"]');
  const lines = popup.innerText.split("\n").filter(Boolean);
  return { lines, width: popup.getBoundingClientRect().width };
}

runScenario("sidebar-preview", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    const [row] = await waitForRole(
      session,
      { role: "button", name: new RegExp(`^${SESSION_TITLE}`) },
      UI_TIMEOUT_MS,
    );
    return { point: await rowCenter(session, row.backendNodeId) };
  },
  steps: [
    [
      "session preview shows the title alone and the activity time last",
      async ({ session, point }) => {
        await hoverUntilPreviewOpens(session, point);
        const preview = await session.run(readPreview);
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
