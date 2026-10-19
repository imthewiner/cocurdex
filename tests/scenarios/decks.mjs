import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole, queryAllByRole, waitForRole } from "./lib/locate.mjs";

const DECK_TITLE = "Checkout review";
const SLIDE_COUNT = 5;
const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();

function translate(session, key, options) {
  return session.run(({ key, options }) => window.__scenario.t(key, options), {
    key,
    options,
  });
}

async function slideLabel(session, number) {
  return translate(session, "decks:viewer.slide", { number });
}

function readStage() {
  const thumbnails = [
    ...document.querySelectorAll("nav button[data-slide-id]"),
  ].map((button) => button.getAttribute("aria-current") === "true");
  const stage = document.querySelector("section > [data-slide-id]");
  const rect = stage?.getBoundingClientRect();
  const boxes = [
    ...(stage?.querySelectorAll('[data-slide-item="text"]') ?? []),
  ].map((box) => ({
    overflow: box.scrollHeight > box.clientHeight + 1,
    left: box.getBoundingClientRect().left,
    top: box.getBoundingClientRect().top,
  }));
  return {
    activeIndex: thumbnails.indexOf(true),
    count: thumbnails.length,
    slideId: stage?.getAttribute("data-slide-id") ?? null,
    ratio: rect ? rect.width / rect.height : 0,
    boxes,
    text: stage?.innerText ?? "",
    focusedSlide: document.activeElement?.getAttribute("data-slide-id"),
  };
}

async function pressKey(session, key) {
  for (const type of ["keyDown", "keyUp"]) {
    await session.send("Input.dispatchKeyEvent", {
      type,
      key,
      code: key,
      windowsVirtualKeyCode: { ArrowRight: 39, Escape: 27, End: 35 }[key],
    });
  }
}

async function waitForActive(session, index) {
  await session.waitUntil(
    (index) =>
      document
        .querySelectorAll("nav button[data-slide-id]")
        [index]?.getAttribute("aria-current") === "true",
    index,
    UI_TIMEOUT_MS,
  );
  return session.run(readStage);
}

runScenario("decks", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    const [openPanel, closePanel, decksTab] = await Promise.all(
      [
        "editor:actions.openEditorPanel",
        "editor:actions.closeEditorPanel",
        "editor:actions.showDecks",
      ].map((key) => translate(session, key)),
    );
    const [toggle] = await waitForRole(
      session,
      { role: "button", name: new RegExp(`^(${openPanel}|${closePanel})$`) },
      UI_TIMEOUT_MS,
    );
    const panelWasOpen = toggle.name === closePanel;
    if (!panelWasOpen) {
      await clickByRole(session, { role: "button", name: openPanel });
    }
    await clickByRole(session, { role: "button", name: decksTab });
    await clickByRole(
      session,
      { role: "button", name: DECK_TITLE },
      UI_TIMEOUT_MS,
    );
    await waitForRole(
      session,
      { role: "button", name: await slideLabel(session, 1) },
      UI_TIMEOUT_MS,
    );
    return { panelWasOpen, closePanel, openPanel };
  },
  steps: [
    [
      "deck opens on its first slide at 16:9 with every slide in the filmstrip",
      async ({ session }) => {
        const stage = await waitForActive(session, 0);
        check(stage.count === SLIDE_COUNT, "slide count", stage);
        check(Math.abs(stage.ratio - 16 / 9) < 0.01, "aspect ratio", stage);
        check(stage.text.includes(DECK_TITLE), "cover title", stage);
        return { ratio: stage.ratio, count: stage.count };
      },
    ],
    [
      "selecting a thumbnail shows that slide and its speaker notes",
      async ({ session }) => {
        await clickByRole(session, {
          role: "button",
          name: await slideLabel(session, 2),
        });
        const stage = await waitForActive(session, 1);
        const notesLabel = await translate(session, "decks:viewer.notes");
        const [notes] = await waitForRole(session, {
          role: "region",
          name: notesLabel,
        });
        const notesText = await session.run(
          (label) =>
            document.querySelector(`[aria-label="${CSS.escape(label)}"]`)
              ?.textContent ?? "",
          notesLabel,
        );
        check(stage.text.includes("Discount codes"), "slide title", stage);
        check(notesText.includes("zero floor"), "speaker notes", notesText);
        check(
          stage.boxes.every((box) => !box.overflow),
          "text overflows its frame",
          stage.boxes,
        );
        return { notes: Boolean(notes) };
      },
    ],
    [
      "arrow keys in the filmstrip move the selection and focus",
      async ({ session }) => {
        await pressKey(session, "ArrowRight");
        const stage = await waitForActive(session, 2);
        check(stage.focusedSlide === stage.slideId, "focus follows", stage);
        const [left, right] = stage.boxes.slice(-2);
        check(
          left && right && right.left > left.left && left.top === right.top,
          "two columns side by side",
          stage.boxes,
        );
        return { boxes: stage.boxes.length };
      },
    ],
    [
      "presentation advances with keys and returns to the last slide",
      async ({ session }) => {
        const present = await translate(session, "decks:actions.present");
        await clickByRole(session, { role: "button", name: present });
        const dialogName = await translate(session, "decks:present.label");
        await waitForRole(session, { role: "dialog", name: dialogName });
        await pressKey(session, "ArrowRight");
        const position = await translate(session, "decks:present.position", {
          current: 4,
          total: SLIDE_COUNT,
        });
        await session.waitUntil(
          (text) => document.body.innerText.includes(text),
          position,
          UI_TIMEOUT_MS,
        );
        await pressKey(session, "Escape");
        await session.waitUntil(
          () => !document.querySelector('[role="dialog"]'),
          null,
          UI_TIMEOUT_MS,
        );
        const stage = await waitForActive(session, 3);
        return { activeIndex: stage.activeIndex };
      },
    ],
    [
      "renderer has no errors",
      async ({ session }) => {
        const errors = await session.run(() => window.__scenario.errors);
        check(errors.length === 0, "renderer errors", errors);
        const leftovers = await queryAllByRole(session, { role: "dialog" });
        check(leftovers.length === 0, "dialog left open", leftovers);
        return {};
      },
    ],
  ],
  teardown: async ({ session, panelWasOpen, closePanel, openPanel }) => {
    const editorTab = await translate(session, "editor:actions.showEditor");
    await clickByRole(session, { role: "button", name: editorTab });
    if (!panelWasOpen) {
      await session.run((label) => {
        window.__scenario.byLabel(label)?.click();
        return true;
      }, closePanel);
      await waitForRole(
        session,
        { role: "button", name: openPanel },
        UI_TIMEOUT_MS,
      );
    }
    return {};
  },
});
