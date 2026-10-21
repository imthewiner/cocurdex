import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clearColorScheme, emulateColorScheme } from "./lib/appearance.mjs";
import {
  hoverUntilTooltipOpens,
  nodeCenter,
  readOpenTooltip,
} from "./lib/hover.mjs";
import { waitForRole } from "./lib/locate.mjs";
import { openNote, showPanelView, translate } from "./lib/navigate.mjs";

const NOTE_TITLE = "Discount math";
const DECK_TITLE = "Checkout review";
const UI_TIMEOUT_MS = 30_000;
const EXACT_TIME = /\d{1,2}:\d{2}:\d{2}/;

const args = readScenarioArgs();

async function hoverRow(session, name) {
  const [row] = await waitForRole(
    session,
    { role: "button", name },
    UI_TIMEOUT_MS,
  );
  await hoverUntilTooltipOpens(
    session,
    await nodeCenter(session, row.backendNodeId),
    UI_TIMEOUT_MS,
  );
  return session.run(readOpenTooltip);
}

function checkRowPreview(preview, title) {
  const [titleLine] = preview.lines;
  const timeLine = preview.lines.at(-1);
  check(titleLine === title, "title line", preview);
  check(EXACT_TIME.test(timeLine), "no exact time", preview);
  check(timeLine.includes(" · "), "no relative age", preview);
}

function readTimestampLine() {
  const time = document.querySelector("time[datetime]");
  if (!time || !document.querySelector(".md-body-prose")) return null;
  return {
    text: time.textContent,
    dateTime: time.getAttribute("datetime"),
    color: getComputedStyle(time).color,
    background: getComputedStyle(document.body).backgroundColor,
  };
}

runScenario("note-timestamps", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    await showPanelView(session, "notes");
    return {};
  },
  steps: [
    [
      "a note row previews its title and edit time",
      async ({ session }) => {
        const preview = await hoverRow(session, NOTE_TITLE);
        checkRowPreview(preview, NOTE_TITLE);
        return preview;
      },
    ],
    [
      "the editor shows when the note was edited, with exact times on hover",
      async ({ session }) => {
        await openNote(session, NOTE_TITLE);
        await session.waitUntil(readTimestampLine, null, UI_TIMEOUT_MS);
        const results = {};
        for (const theme of ["light", "dark"]) {
          await emulateColorScheme(session, theme);
          const line = await session.run(readTimestampLine);
          check(
            !Number.isNaN(Date.parse(line.dateTime)),
            "datetime attribute",
            line,
          );
          check(line.color !== line.background, "time line invisible", line);
          results[theme] = line;
        }
        await clearColorScheme(session);
        const expected = await translate(
          session,
          "notes:editor.timestamps.edited",
          {
            time: "",
          },
        );
        check(results.light.text.includes(expected.trim()), "edited label", {
          expected,
          results,
        });
        const point = await session.run(() => {
          const rect = document
            .querySelector("time[datetime]")
            .getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        });
        await hoverUntilTooltipOpens(session, point, UI_TIMEOUT_MS);
        const tooltip = await session.run(readOpenTooltip);
        check(tooltip.lines.length === 2, "created and edited lines", tooltip);
        check(
          tooltip.lines.every((line) => EXACT_TIME.test(line)),
          "exact times",
          tooltip,
        );
        return { ...results, tooltip };
      },
    ],
    [
      "a deck row previews its title and edit time",
      async ({ session }) => {
        await showPanelView(session, "decks");
        const preview = await hoverRow(session, DECK_TITLE);
        checkRowPreview(preview, DECK_TITLE);
        return preview;
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
