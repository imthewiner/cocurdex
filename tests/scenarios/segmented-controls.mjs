import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { emulateColorScheme } from "./lib/appearance.mjs";
import { waitForRole } from "./lib/locate.mjs";
import { openSettingsSection } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const THEMES = ["light", "dark"];

const args = readScenarioArgs();

function readTrack({ trackSelector, onSelector, offSelector }) {
  const look = (element) => {
    const style = getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      background: style.backgroundColor,
      color: style.color,
    };
  };
  const track = [...document.querySelectorAll(trackSelector)].find(
    (element) =>
      element.querySelector(onSelector) && element.querySelector(offSelector),
  );
  if (!track) {
    return null;
  }
  return {
    track: {
      height: track.getBoundingClientRect().height,
      background: getComputedStyle(track).backgroundColor,
    },
    on: look(track.querySelector(onSelector)),
    off: look(track.querySelector(offSelector)),
  };
}

async function switchTheme(session, theme) {
  await emulateColorScheme(session, theme);
  await session.waitUntil(
    () => document.getAnimations().length === 0,
    null,
    UI_TIMEOUT_MS,
  );
}

async function readSidebarTabs(session) {
  return session.run(readTrack, {
    trackSelector: '[data-slot="tabs-list"]',
    onSelector: '[role="tab"][data-active]',
    offSelector: '[role="tab"]:not([data-active])',
  });
}

async function readSegmentedToggles(session) {
  return session.run(readTrack, {
    trackSelector: '[data-slot="toggle-group"][data-variant="segmented"]',
    onSelector: '[aria-pressed="true"]',
    offSelector: 'button:not([aria-pressed="true"])',
  });
}

runScenario("segmented-controls", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    await waitForRole(session, { role: "tab" }, UI_TIMEOUT_MS);
    return {};
  },
  steps: [
    [
      "the sidebar tabs and settings segmented toggles share one look",
      async ({ session }) => {
        const tabs = {};
        for (const theme of THEMES) {
          await switchTheme(session, theme);
          tabs[theme] = await readSidebarTabs(session);
        }
        await openSettingsSection(session, "appearance");
        await session.waitUntil(
          (selector) => document.querySelector(selector) !== null,
          '[data-slot="toggle-group"][data-variant="segmented"] [aria-pressed="true"]',
          UI_TIMEOUT_MS,
        );
        const looks = {};
        for (const theme of THEMES) {
          await switchTheme(session, theme);
          const toggles = await readSegmentedToggles(session);
          looks[theme] = { tabs: tabs[theme], toggles };
          check(
            JSON.stringify(tabs[theme]) === JSON.stringify(toggles),
            `${theme}: tab list matches the segmented toggle group`,
            looks[theme],
          );
          check(
            toggles.on.background !== toggles.off.background,
            `${theme}: the selected segment is filled`,
            looks[theme],
          );
        }
        return looks;
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
