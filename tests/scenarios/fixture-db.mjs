import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";

const ACTIVE_TITLES = [
  "Add percentage discount codes",
  "Investigate failing checkout",
  "Draft release notes",
];
const ARCHIVED_TITLE = "Spike: gift cards";
const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();
if (args.port) {
  console.error("fixture-db runs only on an isolated instance; omit --port");
  process.exit(2);
}

runScenario("fixture-db", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session, fixtureDb }) => {
    check(fixtureDb, "fixture database was not installed");
    await session.waitUntil(
      (title) => document.body.innerText.includes(title),
      ACTIVE_TITLES[0],
      UI_TIMEOUT_MS,
    );
    return {};
  },
  steps: [
    [
      "sidebar lists seeded sessions",
      async ({ session }) => {
        const text = await session.run(() => document.body.innerText);
        const missing = ACTIVE_TITLES.filter((title) => !text.includes(title));
        check(missing.length === 0, "missing session titles", missing);
        check(!text.includes(ARCHIVED_TITLE), "archived session is listed");
        return { titles: ACTIVE_TITLES.length };
      },
    ],
    [
      "opens a session with tool calls",
      async ({ session }) => {
        await session.run((title) => {
          const label = [...document.querySelectorAll("span, div")].find(
            (element) =>
              element.childElementCount === 0 &&
              element.textContent?.trim() === title,
          );
          const button = label?.closest("button");
          if (!button) throw new Error(`No sidebar item for ${title}`);
          button.click();
          return true;
        }, ACTIVE_TITLES[0]);
        await session.waitUntil(
          () => document.body.innerText.includes("never returns a negative"),
          null,
          UI_TIMEOUT_MS,
        );
        const text = await session.run(() => document.body.innerText);
        check(
          text.includes("Does the README mention discounts?"),
          "second user turn missing",
        );
        return {};
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
