import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import {
  clickByRole,
  clickPoint,
  queryAllByRole,
  waitForRole,
} from "./lib/locate.mjs";

const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();

async function translate(session, key) {
  return session.run((text) => window.__scenario.t(text), key);
}

async function openNote(session, title) {
  await clickByRole(session, { role: "button", name: title });
  await session.waitUntil(
    (text) => document.body.innerText.includes(text),
    title,
    UI_TIMEOUT_MS,
  );
}

async function pressKey(session, key, code = key) {
  for (const type of ["keyDown", "keyUp"]) {
    await session.send("Input.dispatchKeyEvent", {
      type,
      key,
      code,
      windowsVirtualKeyCode: key === "Enter" ? 13 : 35,
    });
  }
}

async function focusEditorEnd(session) {
  const point = await session.run(() => {
    const blocks = document.querySelector(".md-body-prose").children;
    const rect = blocks[blocks.length - 1].getBoundingClientRect();
    return { x: rect.left + 4, y: rect.top + rect.height / 2 };
  });
  await clickPoint(session, point);
  await pressKey(session, "End");
}

async function captureElement(session, selector, name) {
  const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
  if (!artifacts) return null;
  const clip = await session.run((query) => {
    const rect = document.querySelector(query).getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, selector);
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...clip, scale: 1 },
  });
  await mkdir(artifacts, { recursive: true });
  const file = path.join(artifacts, `${name}.png`);
  await writeFile(file, Buffer.from(data, "base64"));
  return file;
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
    const [openPanel, closePanel, notesTab] = await Promise.all(
      [
        "editor:actions.openEditorPanel",
        "editor:actions.closeEditorPanel",
        "editor:actions.showNotes",
      ].map((key) => translate(session, key)),
    );
    const [toggle] = await waitForRole(
      session,
      {
        role: "button",
        name: new RegExp(`^(${openPanel}|${closePanel})$`),
      },
      UI_TIMEOUT_MS,
    );
    if (toggle.name === openPanel) {
      await clickByRole(session, { role: "button", name: openPanel });
    }
    await clickByRole(session, { role: "button", name: notesTab });
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
      "slash menu filters to table and inserts one",
      async ({ session }) => {
        await openNote(session, "Acme Shop roadmap");
        const [menuLabel, tableLabel, taskLabel] = await Promise.all(
          [
            "notes:slash.label",
            "notes:slash.items.table",
            "notes:slash.items.taskList",
          ].map((key) => translate(session, key)),
        );
        const tablesBefore = await session.run(
          () => document.querySelectorAll(".md-body-prose table").length,
        );
        await focusEditorEnd(session);
        await pressKey(session, "Enter");
        await session.send("Input.insertText", { text: "/ta" });
        await waitForRole(
          session,
          { role: "listbox", name: menuLabel },
          UI_TIMEOUT_MS,
        );
        const options = (await queryAllByRole(session, { role: "option" })).map(
          (option) => option.name,
        );
        check(
          options.length === 2 &&
            options.some((name) => name.includes(tableLabel)) &&
            options.some((name) => name.includes(taskLabel)),
          "unexpected slash options",
          options,
        );
        const results = {};
        for (const theme of ["light", "dark"]) {
          await session.run(
            (value) => window.__cocurdexDebug.previewTheme(value),
            theme,
          );
          results[theme] = await captureElement(
            session,
            "[role=listbox]",
            `slash-menu-${theme}`,
          );
        }
        await session.run(() => window.__cocurdexDebug.restoreTheme());
        await clickByRole(session, {
          role: "option",
          name: new RegExp(tableLabel),
        });
        await session.waitUntil(
          (count) =>
            document.querySelectorAll(".md-body-prose table").length > count,
          tablesBefore,
          UI_TIMEOUT_MS,
        );
        return { options, screenshots: results };
      },
    ],
    [
      "collapsed notes sidebar keeps the expand control in the content column",
      async ({ session }) => {
        const [collapse, expand] = await Promise.all(
          ["notes:sidebar.collapse", "notes:sidebar.expand"].map((key) =>
            translate(session, key),
          ),
        );
        await clickByRole(session, { role: "button", name: collapse });
        const [toggle] = await waitForRole(
          session,
          { role: "button", name: expand },
          UI_TIMEOUT_MS,
        );
        const layout = await session.run(() => {
          const button = document.querySelector(
            "button[aria-label][class*='size-3.5']",
          );
          const prose = document.querySelector(".md-body-prose");
          const rect = button.getBoundingClientRect();
          return {
            toggleLeft: rect.left,
            toggleTop: rect.top,
            proseLeft: prose.getBoundingClientRect().left,
          };
        });
        check(layout.toggleLeft < layout.proseLeft, "toggle overlaps body", {
          layout,
          toggle,
        });
        await clickByRole(session, { role: "button", name: expand });
        await waitForRole(
          session,
          { role: "button", name: collapse },
          UI_TIMEOUT_MS,
        );
        return layout;
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
