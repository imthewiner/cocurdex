import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole, waitForRole } from "./lib/locate.mjs";
import { openSettingsSection, translate } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();

function readMenuItems() {
  return [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
    item.textContent.trim(),
  );
}

runScenario("provider-settings", {
  open: () => openScenarioApp(args),
  setup: async ({ session }) => {
    await openSettingsSection(session, "providers");
    return {};
  },
  steps: [
    [
      "the new provider menu offers manual entry and JSON import",
      async ({ session }) => {
        const t = (key) => translate(session, `settings:${key}`);
        await clickByRole(
          session,
          { role: "button", name: await t("providers.actions.newProvider") },
          UI_TIMEOUT_MS,
        );
        const expected = [
          await t("jsonImport.addManually"),
          await t("jsonImport.pasteButton"),
          await t("jsonImport.chooseFile"),
        ];
        await waitForRole(
          session,
          { role: "menuitem", name: expected[0] },
          UI_TIMEOUT_MS,
        );
        const items = await session.run(readMenuItems);
        check(
          JSON.stringify(items) === JSON.stringify(expected),
          "menu lists manual entry, paste, and file import",
          { items, expected },
        );
        await clickByRole(session, { role: "menuitem", name: expected[1] });
        const pasteTitle = await t("providers.importJson.pasteTitle");
        await waitForRole(
          session,
          { role: "dialog", name: pasteTitle },
          UI_TIMEOUT_MS,
        );
        return { items };
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
