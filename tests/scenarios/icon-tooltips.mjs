import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole } from "./lib/locate.mjs";
import { showPanelView, translate } from "./lib/navigate.mjs";

const HOVER_TIMEOUT_MS = 3_000;
const REST_POINT = { x: 2, y: 400 };

const args = readScenarioArgs();

function collectIconButtons() {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.bottom <= 0 || rect.top >= innerHeight) return false;
    if (rect.right <= 0 || rect.left >= innerWidth) return false;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return element.contains(document.elementFromPoint(x, y));
  };
  const buttons = [...document.querySelectorAll("button[aria-label]")].filter(
    (button) =>
      !button.disabled &&
      button.textContent.trim() === "" &&
      !button.closest('[role="dialog"], [role="menu"]') &&
      visible(button),
  );
  window.__iconButtons = buttons;
  return buttons.length;
}

function iconButtonCenter(index) {
  const button = window.__iconButtons[index];
  const rect = button.getBoundingClientRect();
  return {
    name: button.getAttribute("aria-label"),
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function hoverSurfaceText() {
  const surfaces = document.querySelectorAll(
    '[data-slot="tooltip-content"], [data-slot="popover-content"]',
  );
  const text = [...surfaces].map((surface) => surface.textContent.trim());
  return text.find(Boolean) ?? null;
}

function noHoverSurface() {
  const open = document.querySelector(
    '[data-slot="tooltip-content"], [data-slot="popover-content"]',
  );
  return open ? null : true;
}

async function moveMouse(session, point) {
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });
}

async function buttonsWithoutHint(session) {
  const count = await session.run(collectIconButtons);
  const missing = [];
  for (let index = 0; index < count; index += 1) {
    const target = await session.run(iconButtonCenter, index);
    await moveMouse(session, target);
    const hint = await session
      .waitUntil(hoverSurfaceText, undefined, HOVER_TIMEOUT_MS)
      .catch(() => null);
    if (!hint) missing.push(target.name);
    await moveMouse(session, REST_POINT);
    await session.waitUntil(noHoverSurface, undefined, HOVER_TIMEOUT_MS);
  }
  return { count, missing };
}

function viewStep(view) {
  return [
    `every icon-only button in the ${view} view shows a hover hint`,
    async ({ session }) => {
      await showPanelView(session, view);
      const { count, missing } = await buttonsWithoutHint(session);
      check(count > 0, `no icon-only buttons found in the ${view} view`);
      check(missing.length === 0, "icon-only buttons without a hint", missing);
      return { count };
    },
  ];
}

runScenario("icon-tooltips", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async () => ({}),
  steps: [
    viewStep("files"),
    viewStep("git"),
    viewStep("notes"),
    viewStep("issues"),
    viewStep("decks"),
    [
      "renderer has no errors",
      async ({ session }) => {
        const errors = await session.run(() => window.__scenario.errors);
        check(errors.length === 0, "renderer errors", errors);
        return {};
      },
    ],
  ],
  teardown: async ({ session }) => {
    const editorTab = await translate(session, "editor:actions.showEditor");
    await clickByRole(session, { role: "button", name: editorTab });
    return {};
  },
});
