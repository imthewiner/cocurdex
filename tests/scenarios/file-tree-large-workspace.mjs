import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickPoint } from "./lib/locate.mjs";
import { closeEditorPanel, showPanelView } from "./lib/navigate.mjs";

const LISTING_LIMIT = 5000;
const FILLER_DIRECTORY_COUNT = LISTING_LIMIT + 100;
const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();

async function seedLargeWorkspace(root) {
  const filler = path.join(root, "aaa-filler");
  await mkdir(filler);
  for (let start = 0; start < FILLER_DIRECTORY_COUNT; start += 200) {
    await Promise.all(
      Array.from(
        { length: Math.min(200, FILLER_DIRECTORY_COUNT - start) },
        (_, offset) => mkdir(path.join(filler, `d${start + offset}`)),
      ),
    );
  }
  await mkdir(path.join(root, "zzz", "auth"), { recursive: true });
  await writeFile(path.join(root, "zzz", "README.md"), "# zzz\n");
  await writeFile(path.join(root, "zzz", "auth", "token.ts"), "x\n");
}

function findTreeRow(itemPath) {
  const roots = [document];
  for (const root of roots) {
    const row = [...root.querySelectorAll("[data-item-path]")].find(
      (element) => element.dataset.itemPath === itemPath,
    );
    if (row) {
      row.scrollIntoView({ block: "center" });
      const bounds = row.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        return {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        };
      }
    }
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
  }
  return false;
}

async function expandFolder(session, itemPath) {
  await session.waitUntil(findTreeRow, itemPath, UI_TIMEOUT_MS);
  await clickPoint(session, await session.run(findTreeRow, itemPath));
}

runScenario("file-tree-large-workspace", {
  open: () => openScenarioApp(args),
  async setup(opened) {
    await seedLargeWorkspace(opened.workspaceRoot);
    const { wasOpen } = await showPanelView(opened.session, "files");
    return { panelWasOpen: wasOpen };
  },
  steps: [
    [
      "a folder the capped listing missed still shows its files",
      async ({ session }) => {
        await expandFolder(session, "zzz/auth/");
        await session.waitUntil(
          findTreeRow,
          "zzz/auth/token.ts",
          UI_TIMEOUT_MS,
        );
        const shown = await session.run(findTreeRow, "zzz/README.md");
        check(Boolean(shown), "sibling files of the folder are listed too");
        return {};
      },
    ],
  ],
  teardown: async ({ session, panelWasOpen }) => {
    if (!panelWasOpen) await closeEditorPanel(session);
    return {};
  },
});
