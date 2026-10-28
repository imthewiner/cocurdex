import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clearColorScheme, emulateColorScheme } from "./lib/appearance.mjs";
import { daemonRequest } from "./lib/daemon-rpc.mjs";
import { clickByRole, clickPoint, waitForRole } from "./lib/locate.mjs";
import { openNote, showPanelView, translate } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const NOTE_TITLE = "Discount math";
const MENTIONING_NOTE_TITLE = "Scratchpad";
const ISSUE_TITLE = "Support percentage discount codes";
const DECK_TITLE = "Checkout review";

const args = readScenarioArgs();

function linkSelector(kind, id) {
  return `[data-entity-link="${kind}:${id}"]`;
}

async function candidate(session, kind, title) {
  const candidates = await daemonRequest(session, "link.candidates");
  const found = candidates.find(
    (item) => item.target.kind === kind && item.title === title,
  );
  if (!found) throw new Error(`no ${kind} candidate titled ${title}`);
  return found;
}

async function waitForSelector(session, selector, present = true) {
  await session.waitUntil(
    ({ selector, present }) =>
      Boolean(document.querySelector(selector)) === present,
    { selector, present },
    UI_TIMEOUT_MS,
  );
}

async function clickSelector(session, selector) {
  await waitForSelector(session, selector);
  const point = await session.run((target) => {
    const row = document.querySelector(`${target} button`);
    row.scrollIntoView({ block: "center" });
    const rect = row.getBoundingClientRect();
    return { x: rect.x + 24, y: rect.y + rect.height / 2 };
  }, selector);
  await clickPoint(session, point);
}

function readSection(selector) {
  const row = document.querySelector(selector);
  if (!row) return null;
  const section = row.closest("section");
  const rowRect = row.getBoundingClientRect();
  const text = [...row.querySelectorAll("span")].map((span) => ({
    text: span.textContent,
    color: getComputedStyle(span).color,
  }));
  return {
    label: section.getAttribute("aria-label"),
    rowHeight: rowRect.height,
    overflow: row.scrollWidth > row.clientWidth + 1,
    text,
  };
}

runScenario("entity-links", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    const note = await candidate(session, "note", NOTE_TITLE);
    const scratch = await candidate(session, "note", MENTIONING_NOTE_TITLE);
    const issue = await candidate(session, "issue", ISSUE_TITLE);
    const deck = await candidate(session, "deck", DECK_TITLE);
    await showPanelView(session, "notes");
    await waitForRole(
      session,
      { role: "button", name: NOTE_TITLE },
      UI_TIMEOUT_MS,
    );
    await openNote(session, NOTE_TITLE);
    return {
      noteId: note.target.id,
      scratchId: scratch.target.id,
      issueId: issue.target.id,
      issueLabel: `${issue.detail} ${issue.title}`,
      deckId: deck.target.id,
    };
  },
  steps: [
    [
      "linking an issue from a note shows it on both ends",
      async ({ session, noteId, issueId, issueLabel }) => {
        await clickByRole(session, {
          role: "combobox",
          name: await translate(session, "common:links.add"),
        });
        await clickByRole(
          session,
          { role: "option", name: issueLabel },
          UI_TIMEOUT_MS,
        );
        await waitForSelector(session, linkSelector("issue", issueId));
        const fromIssue = await daemonRequest(session, "link.list", {
          ref: { kind: "issue", id: issueId },
        });
        check(
          fromIssue.some(
            (link) =>
              link.target.id === noteId &&
              link.relation === "related" &&
              link.removable,
          ),
          "issue does not list the note",
          fromIssue,
        );
        return { issueLinks: fromIssue.length };
      },
    ],
    [
      "the linked row opens the issue, whose panel links back to the note",
      async ({ session, noteId, issueId }) => {
        await clickSelector(session, linkSelector("issue", issueId));
        await waitForSelector(
          session,
          `[role="dialog"] ${linkSelector("note", noteId)}`,
        );
        await session.waitUntil(
          () =>
            [...document.querySelectorAll('[role="dialog"] img')].every(
              (image) => image.complete,
            ),
          null,
          UI_TIMEOUT_MS,
        );
        await clickSelector(
          session,
          `[role="dialog"] ${linkSelector("note", noteId)}`,
        );
        await session.waitUntil(
          (id) =>
            Boolean(
              document.querySelector(`[data-note-id="${id}"][data-active]`),
            ) && !document.querySelector('[role="dialog"]'),
          noteId,
          UI_TIMEOUT_MS,
        );
        return {};
      },
    ],
    [
      "a link an agent adds appears without a reload",
      async ({ session, noteId, deckId }) => {
        await daemonRequest(session, "link.add", {
          source: { kind: "deck", id: deckId },
          target: { kind: "note", id: noteId },
        });
        await waitForSelector(session, linkSelector("deck", deckId));
        return {};
      },
    ],
    [
      "the linked section reads in both themes",
      async ({ session, deckId }) => {
        const results = {};
        for (const theme of ["light", "dark"]) {
          await emulateColorScheme(session, theme);
          const section = await session.run(
            readSection,
            linkSelector("deck", deckId),
          );
          check(section.rowHeight === 28, "row height", section);
          check(!section.overflow, "row overflows", section);
          results[theme] = section;
        }
        await clearColorScheme(session);
        check(
          results.light.text[0].color !== results.dark.text[0].color,
          "row text ignores the theme",
          results,
        );
        return results;
      },
    ],
    [
      "removing a link drops it from the panel",
      async ({ session, deckId }) => {
        await clickByRole(session, {
          role: "button",
          name: await translate(session, "common:links.remove", {
            title: DECK_TITLE,
          }),
        });
        await waitForSelector(session, linkSelector("deck", deckId), false);
        return {};
      },
    ],
    [
      "a cocurdex link in a note body mentions the issue and opens it",
      async ({ session, scratchId, issueId, noteId }) => {
        const scratch = await daemonRequest(session, "note.get", {
          id: scratchId,
        });
        await daemonRequest(session, "note.update", {
          id: scratchId,
          bodyMarkdown: `${scratch.bodyMarkdown}\nSee [the issue](cocurdex://issue/${issueId}).\n`,
        });
        const fromIssue = await daemonRequest(session, "link.list", {
          ref: { kind: "issue", id: issueId },
        });
        check(
          fromIssue.some(
            (link) =>
              link.target.id === scratchId && link.relation === "mentioned-by",
          ),
          "issue lacks the mention",
          fromIssue,
        );
        await openNote(session, MENTIONING_NOTE_TITLE);
        const point = await session.run((id) => {
          const anchor = document.querySelector(
            `.md-body-prose a[href="cocurdex://issue/${id}"]`,
          );
          if (!anchor) return null;
          const rect = anchor.getBoundingClientRect();
          return { x: rect.x + 4, y: rect.y + rect.height / 2 };
        }, issueId);
        check(point !== null, "link missing from the body", { issueId });
        await clickPoint(session, point);
        await waitForSelector(
          session,
          `[role="dialog"] ${linkSelector("note", scratchId)}`,
        );
        await waitForSelector(
          session,
          `[role="dialog"] ${linkSelector("note", noteId)}`,
        );
        await session.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        await session.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        return { relations: fromIssue.map((link) => link.relation) };
      },
    ],
    [
      "copy link puts the note URI on the clipboard",
      async ({ session, scratchId }) => {
        await session.waitUntil(
          () => !document.querySelector('[role="dialog"]'),
          null,
          UI_TIMEOUT_MS,
        );
        await showPanelView(session, "notes");
        await openNote(session, MENTIONING_NOTE_TITLE);
        await clickByRole(session, {
          role: "button",
          name: await translate(session, "common:links.copy"),
        });
        await session.waitUntil(
          async (expected) =>
            (await navigator.clipboard.readText()) === expected,
          `cocurdex://note/${scratchId}`,
          UI_TIMEOUT_MS,
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
