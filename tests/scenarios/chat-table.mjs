import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clearColorScheme, emulateColorScheme } from "./lib/appearance.mjs";
import { clickByRole } from "./lib/locate.mjs";

const SESSION_ROW = /^Draft release notes/;
const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();

function readDividers() {
  const table = [...document.querySelectorAll("table")].find((candidate) =>
    candidate.textContent.includes("Rounding"),
  );
  if (!table) return null;
  let opacity = 1;
  for (let el = table; el; el = el.parentElement) {
    opacity *= Number(getComputedStyle(el).opacity);
  }
  if (opacity < 1) return null;
  const alphaOf = (color) => {
    const match = color.match(/\/\s*([\d.]+)\s*\)$/);
    if (match) return Number(match[1]);
    return color.startsWith("rgba(")
      ? Number(color.split(",").at(-1).replace(")", ""))
      : 1;
  };
  const head = table.querySelector("thead");
  const rows = [...table.querySelectorAll("tbody tr")];
  table.scrollIntoView({ block: "center" });
  const rect = table.getBoundingClientRect();
  return {
    headColor: getComputedStyle(head).borderBottomColor,
    headAlpha: alphaOf(getComputedStyle(head).borderBottomColor),
    rowColor: getComputedStyle(rows[0]).borderBottomColor,
    rowAlpha: alphaOf(getComputedStyle(rows[0]).borderBottomColor),
    rowWidth: getComputedStyle(rows[0]).borderBottomWidth,
    lastRowWidth: getComputedStyle(rows.at(-1)).borderBottomWidth,
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

async function saveTableShot(session, clip, theme) {
  const dir = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
  if (!dir) return;
  const shot = await session.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...clip, scale: 1 },
    captureBeyondViewport: false,
  });
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `chat-table-${theme}.png`),
    Buffer.from(shot.data, "base64"),
  );
}

runScenario("chat-table", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    await clickByRole(
      session,
      { role: "button", name: SESSION_ROW },
      UI_TIMEOUT_MS,
    );
    return {};
  },
  steps: [
    [
      "row dividers stay fainter than the header divider in both themes",
      async ({ session }) => {
        const results = {};
        for (const theme of ["light", "dark"]) {
          await emulateColorScheme(session, theme);
          await session.waitUntil(readDividers, null, UI_TIMEOUT_MS);
          const dividers = await session.run(readDividers);
          check(dividers.rowWidth === "1px", "row divider width", dividers);
          check(
            dividers.lastRowWidth === "0px",
            "last row keeps a divider",
            dividers,
          );
          check(dividers.rowAlpha > 0, "row divider is invisible", dividers);
          check(
            dividers.rowAlpha < dividers.headAlpha,
            "row divider is as strong as the header divider",
            dividers,
          );
          await saveTableShot(session, dividers.clip, theme);
          results[theme] = dividers;
        }
        await clearColorScheme(session);
        return results;
      },
    ],
  ],
  teardown: async () => ({}),
});
