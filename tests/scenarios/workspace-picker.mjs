import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";

const UI_TIMEOUT_MS = 30_000;
const TOOLTIP_DELAY_MS = 900;
const MULTI_FOLDER_WORKSPACE_ID = "fixture-acme-suite";

const args = readScenarioArgs();
if (args.port) {
  console.error(
    "workspace-picker runs only on an isolated instance; omit --port",
  );
  process.exit(2);
}

async function workspaceTrigger(session) {
  return session.run(async () => {
    const label = await window.__scenario.t("sessions:workspace.workspace");
    const trigger = [
      ...document.querySelectorAll('[data-slot="combobox-trigger"]'),
    ].find((element) => element.getAttribute("aria-label") === label);
    if (!trigger) throw new Error(`No workspace trigger labelled ${label}`);
    const rect = trigger.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      insideTooltip: Boolean(trigger.closest('[data-slot="tooltip-trigger"]')),
    };
  });
}

runScenario("workspace-picker", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session, fixtureDb }) => {
    check(fixtureDb, "fixture database was not installed");
    const suite = fixtureDb.installedWorkspaces.find(
      (workspace) => workspace.id === MULTI_FOLDER_WORKSPACE_ID,
    );
    check(suite, "fixture database lacks the multi-folder workspace");
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
    return {
      workspaceName: suite.name,
      folderNames: suite.rootPaths.map((rootPath) => path.basename(rootPath)),
    };
  },
  steps: [
    [
      "hovering the picker shows no tooltip",
      async ({ session }) => {
        const trigger = await workspaceTrigger(session);
        check(
          !trigger.insideTooltip,
          "workspace picker is wrapped in a tooltip",
        );
        await session.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: trigger.x,
          y: trigger.y,
        });
        await delay(TOOLTIP_DELAY_MS);
        const tooltipOpen = await session.run(() =>
          Boolean(document.querySelector('[data-slot="tooltip-content"]')),
        );
        check(!tooltipOpen, "tooltip opened on the workspace picker");
        return {};
      },
    ],
    [
      "the dropdown lists every folder of a multi-folder workspace",
      async ({ session, workspaceName, folderNames }) => {
        const trigger = await workspaceTrigger(session);
        for (const type of ["mousePressed", "mouseReleased"]) {
          await session.send("Input.dispatchMouseEvent", {
            type,
            button: "left",
            clickCount: 1,
            x: trigger.x,
            y: trigger.y,
          });
        }
        const findOptionText = (name) =>
          [...document.querySelectorAll('[data-slot="combobox-item"]')]
            .map((item) => item.innerText)
            .find((text) => text.includes(name)) ?? null;
        await session.waitUntil(
          (name) =>
            [...document.querySelectorAll('[data-slot="combobox-item"]')].some(
              (item) => item.innerText.includes(name),
            ),
          workspaceName,
          UI_TIMEOUT_MS,
        );
        const optionText = await session.run(findOptionText, workspaceName);
        const lines = String(optionText)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        check(
          lines[0] === workspaceName,
          "option title is not the workspace name",
          lines,
        );
        const [, ...rootLines] = lines;
        check(
          rootLines.length === folderNames.length &&
            folderNames.every((name, index) =>
              rootLines[index].startsWith(name),
            ),
          "option does not list every folder name-first",
          { lines, folderNames },
        );
        return { lines };
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
