import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole, waitForRole } from "./lib/locate.mjs";

const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();

async function openNote(session, title) {
  await clickByRole(session, { role: "button", name: title });
  await session.waitUntil(
    (text) => document.body.innerText.includes(text),
    title,
    UI_TIMEOUT_MS,
  );
}

function readTableLayout() {
  const table = document.querySelector(".md-body-prose table");
  if (!table) return null;
  const header = table.querySelector("th");
  const cell = table.querySelector("td");
  const cellParagraph = cell.querySelector("p");
  const headerStyle = getComputedStyle(header);
  const cellStyle = getComputedStyle(cell);
  return {
    headerAlign: headerStyle.textAlign,
    headerBackground: headerStyle.backgroundColor,
    cellBorderWidth: cellStyle.borderTopWidth,
    cellBorderStyle: cellStyle.borderTopStyle,
    cellParagraphMargin: getComputedStyle(cellParagraph).marginTop,
    rowHeight: cell.parentElement.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(cellStyle.lineHeight),
  };
}

async function captureTable(session, theme) {
  const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
  if (!artifacts) return null;
  const clip = await session.run(() => {
    const rect = document
      .querySelector(".md-body-prose .tableWrapper")
      .getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...clip, scale: 1 },
  });
  await mkdir(artifacts, { recursive: true });
  const file = path.join(artifacts, `note-table-${theme}.png`);
  await writeFile(file, Buffer.from(data, "base64"));
  return file;
}

runScenario("note-table", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    const [toggle] = await waitForRole(
      session,
      { role: "button", name: /^(打开|关闭)功能区$/ },
      UI_TIMEOUT_MS,
    );
    if (toggle.name === "打开功能区") {
      await clickByRole(session, { role: "button", name: "打开功能区" });
    }
    await clickByRole(session, { role: "button", name: "笔记" });
    await waitForRole(
      session,
      { role: "button", name: "Checkout spec" },
      UI_TIMEOUT_MS,
    );
    return {};
  },
  steps: [
    [
      "body does not repeat the note title as a heading",
      async ({ session }) => {
        await openNote(session, "Acme Shop roadmap");
        await session.waitUntil(
          () => Boolean(document.querySelector(".md-body-prose h2")),
          null,
          UI_TIMEOUT_MS,
        );
        const headings = await session.run(() =>
          [
            ...document.querySelectorAll(
              ".md-body-prose h1, .md-body-prose h2",
            ),
          ].map((node) => node.textContent),
        );
        check(
          !headings.includes("Acme Shop roadmap"),
          "title repeated in body",
          headings,
        );
        return { headings };
      },
    ],
    [
      "table renders with borders, start-aligned headers, and compact rows",
      async ({ session }) => {
        await openNote(session, "Checkout spec");
        await session.waitUntil(
          () => Boolean(document.querySelector(".md-body-prose table td p")),
          null,
          UI_TIMEOUT_MS,
        );
        const results = {};
        for (const theme of ["light", "dark"]) {
          await session.run(
            (value) => window.__cocurdexDebug.previewTheme(value),
            theme,
          );
          const layout = await session.run(readTableLayout);
          check(layout.headerAlign === "start", "header centered", layout);
          check(
            layout.cellBorderStyle === "solid",
            "cell has no border",
            layout,
          );
          check(layout.cellParagraphMargin === "0px", "cell margin", layout);
          check(
            layout.rowHeight < layout.lineHeight * 2,
            "row too tall",
            layout,
          );
          results[theme] = {
            ...layout,
            screenshot: await captureTable(session, theme),
          };
        }
        await session.run(() => window.__cocurdexDebug.restoreTheme());
        return results;
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
