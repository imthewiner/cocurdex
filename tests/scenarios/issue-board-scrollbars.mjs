import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { daemonRequest } from "./lib/daemon-rpc.mjs";
import { showPanelView } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const EXTRA_ISSUES = 14;

const args = readScenarioArgs();

function markOverflowingColumn() {
  const column = [
    ...document.querySelectorAll("[data-slot=scroll-area][data-overflowing-y]"),
  ].find((area) => area.parentElement?.closest("[data-slot=scroll-area]"));
  window.__overflowingColumn = column;
  return Boolean(column);
}

function columnScrollbarOpacity(expected) {
  const scrollbar = window.__overflowingColumn.querySelector(
    ":scope > [data-slot=scroll-area-scrollbar][data-orientation=vertical]",
  );
  const opacity = Number(getComputedStyle(scrollbar).opacity);
  return expected === null ? opacity : opacity === expected;
}

async function hover(session, readPoint) {
  const { x, y, ...rest } = await session.run(readPoint);
  await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  return { x, y, ...rest };
}

function pointInColumn() {
  const rect = window.__overflowingColumn.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function pointBeforeColumn() {
  const column = window.__overflowingColumn;
  const rect = column.getBoundingClientRect();
  const point = { x: rect.left - 10, y: rect.top + rect.height / 2 };
  const target = document.elementFromPoint(point.x, point.y);
  const board = column.parentElement.closest("[data-slot=scroll-area]");
  return {
    ...point,
    onBoard: Boolean(board?.contains(target)) && !column.contains(target),
  };
}

runScenario("issue-board-scrollbars", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    const [view] = await daemonRequest(session, "issue.listViews");
    const created = [];
    for (let index = 0; index < EXTRA_ISSUES; index += 1) {
      const issue = await daemonRequest(session, "issue.create", {
        viewId: view.id,
        title: `Scrollbar filler ${index + 1}`,
        description: "Keeps the column taller than the board.",
      });
      created.push(issue.id);
    }
    await showPanelView(session, "issues");
    await session.waitUntil(markOverflowingColumn, null, UI_TIMEOUT_MS);
    return { created };
  },
  steps: [
    [
      "hovering a column reveals its scrollbar",
      async ({ session }) => {
        await hover(session, pointInColumn);
        await session.waitUntil(columnScrollbarOpacity, 1, UI_TIMEOUT_MS);
        return { opacity: await session.run(columnScrollbarOpacity) };
      },
    ],
    [
      "leaving the column for the rest of the board hides its scrollbar",
      async ({ session }) => {
        const point = await hover(session, pointBeforeColumn);
        check(point.onBoard, "hover point is not on the board", point);
        const hidden = await session
          .waitUntil(columnScrollbarOpacity, 0, 5_000)
          .then(
            () => true,
            () => false,
          );
        const opacity = await session.run(columnScrollbarOpacity);
        check(hidden, "column scrollbar stays visible off the column", {
          point,
          opacity,
        });
        return { point, opacity };
      },
    ],
  ],
  teardown: async ({ session, created = [] }) => {
    for (const id of created) {
      await daemonRequest(session, "issue.delete", { id });
    }
    return {};
  },
});
