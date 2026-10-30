import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clearColorScheme, emulateColorScheme } from "./lib/appearance.mjs";
import { clickPoint, waitForNoRole, waitForRole } from "./lib/locate.mjs";
import { openSettingsSection, translate } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const BUILTIN_AGENT_ID = "pi";

const args = readScenarioArgs();

function readRows() {
  const rows = [...document.querySelectorAll("button[data-agent-id]")];
  return {
    pageOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    rows: rows.map((row) => {
      const rect = row.getBoundingClientRect();
      const status = row.lastElementChild;
      const dot = status?.lastElementChild;
      const dotRect =
        dot?.getAttribute("aria-hidden") === "true"
          ? dot.getBoundingClientRect()
          : null;
      return {
        id: row.dataset.agentId,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        overflow: row.scrollWidth - row.clientWidth,
        dotRight: dotRect ? rect.right - dotRect.right : null,
      };
    }),
  };
}

function readDialog() {
  const dialog = document.querySelector('[role="dialog"]');
  const rect = dialog?.getBoundingClientRect();
  return {
    open: Boolean(dialog),
    width: rect?.width ?? 0,
    overflow: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
  };
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

async function capture(session, name) {
  const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
  if (!artifacts) return null;
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
  });
  await mkdir(artifacts, { recursive: true });
  const file = path.join(artifacts, `agent-cli-settings-${name}.png`);
  await writeFile(file, Buffer.from(data, "base64"));
  return file;
}

async function openAgentDialog(session, agentId) {
  const center = await session.run((id) => {
    const rect = document
      .querySelector(`button[data-agent-id="${id}"]`)
      ?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
  }, agentId);
  check(center, `row for ${agentId} is rendered`);
  await clickPoint(session, center);
}

runScenario("agent-cli-settings", {
  open: () => openScenarioApp(args),
  setup: async ({ session }) => {
    await openSettingsSection(session, "adapters");
    const t = (key, options) => translate(session, `settings:${key}`, options);
    await session.waitUntil(
      (id) => Boolean(document.querySelector(`button[data-agent-id="${id}"]`)),
      BUILTIN_AGENT_ID,
      UI_TIMEOUT_MS,
    );
    return { t };
  },
  steps: [
    [
      "agent rows share one width, one height, and one status edge",
      async ({ session }) => {
        const layout = await session.run(readRows);
        check(layout.rows.length > 0, "agent rows render", layout);
        check(
          layout.pageOverflow <= 0,
          "page does not scroll sideways",
          layout,
        );
        const [first] = layout.rows;
        for (const row of layout.rows) {
          check(Math.abs(row.height - 52) < 0.5, "rows are 52px tall", row);
          check(
            Math.abs(row.left - first.left) < 0.5 &&
              Math.abs(row.right - first.right) < 0.5,
            "rows share edges",
            row,
          );
          check(row.overflow <= 0, "row content fits", row);
        }
        const dotEdges = layout.rows
          .map((row) => row.dotRight)
          .filter((edge) => edge !== null);
        check(
          dotEdges.every((edge) => Math.abs(edge - dotEdges[0]) < 0.5),
          "status dots line up on the trailing edge",
          dotEdges,
        );
        return { rows: layout.rows.length, statusDots: dotEdges.length };
      },
    ],
    [
      "a row opens its detail dialog and Escape closes it",
      async ({ session }) => {
        const label = await session.run(
          (id) =>
            document
              .querySelector(`button[data-agent-id="${id}"] .font-medium`)
              ?.textContent?.trim(),
          BUILTIN_AGENT_ID,
        );
        await openAgentDialog(session, BUILTIN_AGENT_ID);
        await waitForRole(
          session,
          { role: "dialog", name: label },
          UI_TIMEOUT_MS,
        );
        const dialog = await session.run(readDialog);
        check(dialog.overflow <= 0, "dialog content fits", dialog);
        await pressEscape(session);
        await waitForNoRole(session, { role: "dialog" }, UI_TIMEOUT_MS);
        return { dialogWidth: dialog.width };
      },
    ],
    [
      "the dialog renders in both themes",
      async ({ session }) => {
        const shots = [];
        for (const scheme of ["light", "dark"]) {
          await emulateColorScheme(session, scheme);
          shots.push(await capture(session, `${scheme}-list`));
          await openAgentDialog(session, BUILTIN_AGENT_ID);
          await waitForRole(session, { role: "dialog" }, UI_TIMEOUT_MS);
          shots.push(await capture(session, scheme));
          await pressEscape(session);
          await waitForNoRole(session, { role: "dialog" }, UI_TIMEOUT_MS);
        }
        await clearColorScheme(session);
        return { shots: shots.filter(Boolean) };
      },
    ],
  ],
  teardown: async () => ({}),
});
