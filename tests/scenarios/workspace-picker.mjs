import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";

const UI_TIMEOUT_MS = 30_000;
const TOOLTIP_DELAY_MS = 900;
const WORKSPACE_STORE_MODULE = "/src/features/workspaces/workspace-store.ts";
const SECOND_ROOT_NAME = "acme-docs";

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
    const secondRoot = path.join(
      path.dirname(fixtureDb.workspacePath),
      SECOND_ROOT_NAME,
    );
    await mkdir(secondRoot, { recursive: true });
    const newSessionLabel = await session.run(() =>
      window.__scenario.t("sessions:sidebar.newSession"),
    );
    await session.waitUntil(
      (label) => Boolean(window.__scenario.byLabel(label)),
      newSessionLabel,
      UI_TIMEOUT_MS,
    );
    await session.run(
      async ({ storeModule, workspaceId, rootPaths }) => {
        const store = await window.__scenario.store(storeModule);
        const module = await import(storeModule);
        await store.set(module.updateWorkspaceAtom, workspaceId, { rootPaths });
        return true;
      },
      {
        storeModule: WORKSPACE_STORE_MODULE,
        workspaceId: fixtureDb.workspaceId,
        rootPaths: [fixtureDb.workspacePath, secondRoot],
      },
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
    return { workspaceName: fixtureDb.workspaceName };
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
      async ({ session, workspaceName }) => {
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
          rootLines.length === 2 &&
            rootLines[0].startsWith(workspaceName) &&
            rootLines[1].startsWith(SECOND_ROOT_NAME),
          "option does not list both folders name-first",
          lines,
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
