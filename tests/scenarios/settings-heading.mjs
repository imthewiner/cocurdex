import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { waitForRole } from "./lib/locate.mjs";
import { openSettingsSection, translate } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const SHORT_VIEWPORT = { width: 1200, height: 480 };

const args = readScenarioArgs();

function readHeading() {
  const headings = document.querySelectorAll("main h1");
  const heading = headings[0];
  const content =
    heading?.nextElementSibling ?? heading?.parentElement?.nextElementSibling;
  const compact = document.querySelector(
    '[data-testid="settings-compact-title"]',
  );
  return {
    headingCount: headings.length,
    headingLeft: heading?.getBoundingClientRect().left,
    contentLeft: content?.getBoundingClientRect().left,
    compactOpacity: compact ? Number(getComputedStyle(compact).opacity) : null,
  };
}

function scrollSettingsTo(top) {
  const viewport = document.querySelector(
    "main > section [data-slot=scroll-area-viewport]",
  );
  viewport.scrollTop = top;
  return viewport.scrollTop;
}

function compactOpacityIs(expected) {
  const compact = document.querySelector(
    '[data-testid="settings-compact-title"]',
  );
  return compact && Number(getComputedStyle(compact).opacity) === expected;
}

async function expectHeading(session, section) {
  const name = await translate(session, `settings:sections.${section}`);
  await openSettingsSection(session, section);
  await waitForRole(session, { role: "heading", name }, UI_TIMEOUT_MS);
  const layout = await session.run(readHeading);
  check(layout.headingCount === 1, "one page heading", layout);
  check(
    Math.abs(layout.headingLeft - layout.contentLeft) < 0.5,
    "heading aligns with the content column",
    layout,
  );
  check(layout.compactOpacity === 0, "compact title hidden at rest", layout);
  return layout;
}

runScenario("settings-heading", {
  open: () => openScenarioApp(args),
  setup: async () => ({}),
  steps: [
    [
      "a scrolling section shows its title in the content column",
      async ({ session }) => expectHeading(session, "general"),
    ],
    [
      "a fill section shows its title in the content column",
      async ({ session }) => expectHeading(session, "mcp"),
    ],
    [
      "the compact title appears only after the page title scrolls away",
      async ({ session }) => {
        await session.send("Emulation.setDeviceMetricsOverride", {
          ...SHORT_VIEWPORT,
          deviceScaleFactor: 0,
          mobile: false,
        });
        try {
          await expectHeading(session, "general");
          await session.run(scrollSettingsTo, 20);
          await session.waitUntil(compactOpacityIs, 0, UI_TIMEOUT_MS);
          const scrolled = await session.run(scrollSettingsTo, 400);
          check(scrolled > 100, "general section scrolls", { scrolled });
          await session.waitUntil(compactOpacityIs, 1, UI_TIMEOUT_MS);
          await session.run(scrollSettingsTo, 0);
          await session.waitUntil(compactOpacityIs, 0, UI_TIMEOUT_MS);
          return { scrolled };
        } finally {
          await session.send("Emulation.clearDeviceMetricsOverride");
        }
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
