import { setTimeout as delay } from "node:timers/promises";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";

const UI_TIMEOUT_MS = 30_000;
const TOOLTIP_DELAY_MS = 900;
const SAMPLE_MS = 400;

const args = readScenarioArgs();

async function workspaceTriggerCenter(session) {
  return session.run(async () => {
    const label = await window.__scenario.t("sessions:workspace.workspace");
    const trigger = [
      ...document.querySelectorAll('[data-slot="combobox-trigger"]'),
    ].find(
      (element) =>
        element.getAttribute("aria-label") === label &&
        element.closest('[data-slot="tooltip-trigger"]'),
    );
    if (!trigger) throw new Error(`No workspace trigger labelled ${label}`);
    const rect = trigger.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
}

function startTooltipSampling(session) {
  return session.run((sampleMs) => {
    const frames = [];
    const start = performance.now();
    window.__tooltipFrames = frames;
    const sample = () => {
      const popup = document.querySelector('[data-slot="tooltip-content"]');
      if (popup) {
        const style = getComputedStyle(popup);
        frames.push({
          closed: popup.hasAttribute("data-closed"),
          visible:
            style.visibility !== "hidden" && Number(style.opacity) > 0.01,
        });
      }
      if (performance.now() - start < sampleMs) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    return true;
  }, SAMPLE_MS);
}

async function hoverUntilTooltipOpens(session, point) {
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x - 200,
    y: point.y + 200,
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

async function pressEscape(session) {
  for (const type of ["keyDown", "keyUp"]) {
    await session.send("Input.dispatchKeyEvent", {
      type,
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
  }
}

runScenario("tooltip-dismiss", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    const newSessionLabel = await session.run(() =>
      window.__scenario.t("sessions:sidebar.newSession"),
    );
    await session.waitUntil(
      (label) => Boolean(window.__scenario.byLabel(label)),
      newSessionLabel,
      UI_TIMEOUT_MS,
    );
    await session.run((label) => {
      window.__scenario.byLabel(label).click();
      return true;
    }, newSessionLabel);
    await session.waitUntil(
      () => Boolean(document.querySelector('[data-slot="combobox-trigger"]')),
      null,
      UI_TIMEOUT_MS,
    );
    return { point: await workspaceTriggerCenter(session) };
  },
  steps: [
    [
      "pressing the trigger hides its tooltip without a visible closing frame",
      async ({ session, point }) => {
        await hoverUntilTooltipOpens(session, point);
        await startTooltipSampling(session);
        await session.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          button: "left",
          buttons: 1,
          clickCount: 1,
          ...point,
        });
        await session.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          button: "left",
          clickCount: 1,
          ...point,
        });
        await delay(SAMPLE_MS + 100);
        const frames = await session.run(() => window.__tooltipFrames);
        const visibleClosing = frames.filter(
          (frame) => frame.closed && frame.visible,
        );
        check(
          visibleClosing.length === 0,
          "closed tooltip was visible after press",
          frames,
        );
        await pressEscape(session);
        return { sampledFrames: frames.length };
      },
    ],
    [
      "leaving the trigger still fades the tooltip out",
      async ({ session, point }) => {
        await delay(300);
        await hoverUntilTooltipOpens(session, point);
        await startTooltipSampling(session);
        await session.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: point.x,
          y: point.y - 160,
        });
        await delay(SAMPLE_MS + 100);
        const frames = await session.run(() => window.__tooltipFrames);
        const fadingFrames = frames.filter(
          (frame) => frame.closed && frame.visible,
        );
        check(fadingFrames.length > 1, "tooltip did not fade out", frames);
        return { fadingFrames: fadingFrames.length };
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
