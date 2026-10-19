import { createRequire } from "node:module";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole, queryAllByRole, waitForRole } from "./lib/locate.mjs";

const DECK_TITLE = "Checkout review";
const SLIDE_COUNT = 5;
const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();
const fixture = (name) =>
  createRequire(import.meta.url).resolve(`./fixtures/deck-images/${name}`);

async function chooseFile(session, filePath, action) {
  await session.send("Page.enable");
  await session.send("Page.setInterceptFileChooserDialog", { enabled: true });
  let unsubscribe = () => {};
  const chosen = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("File chooser did not open")),
      UI_TIMEOUT_MS,
    );
    unsubscribe = session.on("Page.fileChooserOpened", (event) => {
      clearTimeout(timer);
      session
        .send("DOM.setFileInputFiles", {
          files: [filePath],
          backendNodeId: event.backendNodeId,
        })
        .then(resolve, reject);
    });
  });
  chosen.catch(() => {});
  try {
    await action();
    await chosen;
  } finally {
    unsubscribe();
    await session.send("Page.setInterceptFileChooserDialog", {
      enabled: false,
    });
  }
}

function readStageImage() {
  const stage = document.querySelector("section > [data-slide-id]");
  const image = stage?.querySelector('img[data-slide-item="image"]');
  if (!image?.complete || !image.naturalWidth) return null;
  const box = image.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  return {
    src: image.src.slice(0, 5),
    naturalWidth: image.naturalWidth,
    ratio: box.width / box.height,
    centerX: (box.left + box.width / 2 - frame.left) / frame.width,
  };
}

async function waitForStageImage(session, naturalWidth) {
  await session.waitUntil(
    (width) => {
      const image = document.querySelector(
        'section > [data-slide-id] img[data-slide-item="image"]',
      );
      return image?.complete && image.naturalWidth === width;
    },
    naturalWidth,
    UI_TIMEOUT_MS,
  );
  return session.run(readStageImage);
}

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

const COMMIT_MODIFIER = process.platform === "darwin" ? 4 : 2;
const KEY_CODES = {
  ArrowRight: 39,
  Backspace: 8,
  End: 35,
  Enter: 13,
  Escape: 27,
};

async function pressKey(session, key, modifiers = 0) {
  for (const type of ["keyDown", "keyUp"]) {
    await session.send("Input.dispatchKeyEvent", {
      type,
      key,
      code: key,
      modifiers,
      windowsVirtualKeyCode: KEY_CODES[key],
    });
  }
}

async function waitForStageText(session, expected, absent = null) {
  await session.waitUntil(
    ({ expected, absent }) => {
      const text =
        document.querySelector("section > [data-slide-id]")?.innerText ?? "";
      return text.includes(expected) && !(absent && text.includes(absent));
    },
    { expected, absent },
    UI_TIMEOUT_MS,
  );
  return session.run(readStage);
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
          role: "textbox",
          name: notesLabel,
        });
        const notesText = await session.run(
          (label) =>
            document.querySelector(
              `textarea[aria-label="${CSS.escape(label)}"]`,
            )?.value ?? "",
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
      "presenter view drives a synced audience window",
      async ({ session }) => {
        const presenterButton = await translate(
          session,
          "decks:actions.presenterView",
        );
        await clickByRole(session, { role: "button", name: presenterButton });
        const presenterLabel = await translate(
          session,
          "decks:presenter.label",
        );
        await waitForRole(session, { role: "dialog", name: presenterLabel });
        const currentLabel = await translate(
          session,
          "decks:presenter.current",
        );
        const presenterSlide = () =>
          session.run(
            (label) =>
              document
                .querySelector(
                  `[aria-label="${CSS.escape(label)}"] [data-slide-id]`,
                )
                ?.getAttribute("data-slide-id") ?? null,
            currentLabel,
          );
        const audience = await session.openPage("window=deck-audience");
        try {
          const waitForAudience = (slideId) =>
            audience.waitUntil(
              (slideId) =>
                document
                  .querySelector("main [data-slide-id]")
                  ?.getAttribute("data-slide-id") === slideId,
              slideId,
              UI_TIMEOUT_MS,
            );
          const first = await presenterSlide();
          await waitForAudience(first);
          const elapsedLabel = await translate(
            session,
            "decks:presenter.elapsed",
          );
          await session.waitUntil(
            (label) =>
              document.querySelector(`[aria-label="${CSS.escape(label)}"]`)
                ?.textContent !== "00:00",
            elapsedLabel,
            UI_TIMEOUT_MS,
          );
          const stillOpen = (await session.pageUrls()).some((url) =>
            url.includes("window=deck-audience"),
          );
          check(stillOpen, "audience window closed itself after opening");

          await pressKey(session, "ArrowRight");
          const second = await presenterSlide();
          check(second && second !== first, "presenter advanced", {
            first,
            second,
          });
          await waitForAudience(second);

          await audience.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "ArrowLeft",
            code: "ArrowLeft",
            windowsVirtualKeyCode: 37,
          });
          await audience.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "ArrowLeft",
            code: "ArrowLeft",
            windowsVirtualKeyCode: 37,
          });
          await session.waitUntil(
            ({ label, slideId }) =>
              document
                .querySelector(
                  `[aria-label="${CSS.escape(label)}"] [data-slide-id]`,
                )
                ?.getAttribute("data-slide-id") === slideId,
            { label: currentLabel, slideId: first },
            UI_TIMEOUT_MS,
          );

          const endLabel = await translate(session, "decks:presenter.end");
          const chrome = await session.run((label) => {
            const button = [
              ...document.querySelectorAll('[role="dialog"] button'),
            ].find((item) => item.textContent === label);
            const first = button?.parentElement?.firstElementChild;
            const probe = document.createElement("div");
            probe.style.width = "var(--titlebar-controls-inset)";
            document.body.append(probe);
            const inset = probe.getBoundingClientRect().width;
            probe.remove();
            return {
              trafficLights: document.documentElement.hasAttribute(
                "data-traffic-lights",
              ),
              firstLeft: first?.getBoundingClientRect().left ?? -1,
              buttonRight: button?.getBoundingClientRect().right ?? Infinity,
              width: window.innerWidth,
              inset,
            };
          }, endLabel);
          check(
            !chrome.trafficLights || chrome.firstLeft >= 80,
            "header content under the macOS traffic lights",
            chrome,
          );
          check(
            chrome.buttonRight <= chrome.width - chrome.inset,
            "header action under the window controls",
            chrome,
          );
          await clickByRole(session, { role: "button", name: endLabel });
          await session.waitUntil(
            () => !document.querySelector('[role="dialog"]'),
            null,
            UI_TIMEOUT_MS,
          );
          const deadline = Date.now() + UI_TIMEOUT_MS;
          let urls = await session.pageUrls();
          while (urls.some((url) => url.includes("window=deck-audience"))) {
            check(Date.now() < deadline, "audience window stays open", urls);
            await new Promise((resolve) => setTimeout(resolve, 100));
            urls = await session.pageUrls();
          }
          return { first, second, audienceFollowed: true };
        } finally {
          audience.close();
        }
      },
    ],
    [
      "editing a title in place saves it and the edit can be reverted",
      async ({ session }) => {
        await clickByRole(session, {
          role: "button",
          name: await slideLabel(session, 2),
        });
        await waitForActive(session, 1);
        const [edit, editorName] = await Promise.all([
          translate(session, "decks:editor.edit", {
            name: await translate(session, "decks:editor.slots.title"),
          }),
          translate(session, "decks:editor.slots.title"),
        ]);
        const typeIntoTitle = async (apply) => {
          await clickByRole(session, { role: "button", name: edit });
          await waitForRole(session, { role: "textbox", name: editorName });
          await session.waitUntil(
            () =>
              document.activeElement?.closest("[data-slide-editor]") !== null,
            null,
            UI_TIMEOUT_MS,
          );
          await apply();
          await pressKey(session, "Enter", COMMIT_MODIFIER);
          await session.waitUntil(
            () => !document.querySelector("[data-slide-editor]"),
            null,
            UI_TIMEOUT_MS,
          );
        };
        await typeIntoTitle(() =>
          session.send("Input.insertText", { text: " v2" }),
        );
        const edited = await waitForStageText(session, "Discount codes v2");
        await typeIntoTitle(async () => {
          for (let count = 0; count < 3; count += 1) {
            await pressKey(session, "Backspace");
          }
        });
        const reverted = await waitForStageText(
          session,
          "Discount codes",
          "v2",
        );
        check(
          reverted.count === SLIDE_COUNT,
          "slide count after edit",
          reverted,
        );
        return { edited: edited.text.split("\n")[0] };
      },
    ],
    [
      "toolbar adds a slide with placeholders and the filmstrip deletes it",
      async ({ session }) => {
        const [addLabel, layoutName, deleteLabel, titlePlaceholder] =
          await Promise.all(
            [
              "decks:actions.addSlide",
              "decks:layouts.title-only",
              "decks:slideMenu.delete",
              "decks:editor.placeholders.title",
            ].map((key) => translate(session, key)),
          );
        await clickByRole(session, { role: "button", name: addLabel });
        await clickByRole(
          session,
          { role: "menuitem", name: layoutName },
          UI_TIMEOUT_MS,
        );
        const added = await waitForActive(session, 2);
        check(added.count === SLIDE_COUNT + 1, "slide added", added);
        check(
          added.text.includes(titlePlaceholder),
          "empty title placeholder",
          added,
        );
        await clickByRole(
          session,
          { role: "button", name: await slideLabel(session, 3) },
          UI_TIMEOUT_MS,
          "right",
        );
        await clickByRole(
          session,
          { role: "menuitem", name: deleteLabel },
          UI_TIMEOUT_MS,
        );
        await session.waitUntil(
          (count) =>
            document.querySelectorAll("nav button[data-slide-id]").length ===
            count,
          SLIDE_COUNT,
          UI_TIMEOUT_MS,
        );
        const after = await session.run(readStage);
        check(after.count === SLIDE_COUNT, "slide deleted", after);
        return { added: added.count, after: after.count };
      },
    ],
    [
      "layout and theme menus restyle the slide and switch back",
      async ({ session }) => {
        await clickByRole(session, {
          role: "button",
          name: await slideLabel(session, 2),
        });
        await waitForActive(session, 1);
        const [
          layoutLabel,
          themeLabel,
          twoColumns,
          titleContent,
          midnight,
          base,
        ] = await Promise.all(
          [
            "decks:actions.layout",
            "decks:actions.theme",
            "decks:layouts.two-content",
            "decks:layouts.title-content",
            "decks:themes.midnight",
            "decks:themes.default",
          ].map((key) => translate(session, key)),
        );
        const choose = async (menu, item) => {
          await clickByRole(session, { role: "button", name: menu });
          await clickByRole(
            session,
            { role: "menuitemradio", name: item },
            UI_TIMEOUT_MS,
          );
          await session.waitUntil(
            () => !document.querySelector('[role="menu"]'),
            null,
            UI_TIMEOUT_MS,
          );
        };
        const columnLefts = () =>
          session.run(() => {
            const stage = document.querySelector("section > [data-slide-id]");
            const lefts = [
              ...(stage?.querySelectorAll('[data-slide-item="text"]') ?? []),
            ].map((box) => Math.round(box.getBoundingClientRect().left));
            return new Set(lefts).size;
          });
        await choose(layoutLabel, twoColumns);
        await session.waitUntil(
          () =>
            document.querySelector('[data-slide-target="slot:right"]') !== null,
          null,
          UI_TIMEOUT_MS,
        );
        const columns = await session.run(readStage);
        check(
          columns.text.includes("Totals never drop below zero"),
          "body kept in the left column",
          columns,
        );
        await choose(layoutLabel, titleContent);
        await session.waitUntil(
          () => !document.querySelector('[data-slide-target="slot:right"]'),
          null,
          UI_TIMEOUT_MS,
        );
        const background = () =>
          session.run(
            () =>
              getComputedStyle(
                document.querySelector("section > [data-slide-id]"),
              ).backgroundColor,
          );
        await choose(themeLabel, midnight);
        await session.waitUntil(
          () =>
            getComputedStyle(
              document.querySelector("section > [data-slide-id]"),
            ).backgroundColor === "rgb(15, 20, 27)",
          null,
          UI_TIMEOUT_MS,
        );
        const dark = await background();
        await choose(themeLabel, base);
        await session.waitUntil(
          () =>
            getComputedStyle(
              document.querySelector("section > [data-slide-id]"),
            ).backgroundColor === "rgb(255, 255, 255)",
          null,
          UI_TIMEOUT_MS,
        );
        return { dark, distinctLefts: await columnLefts() };
      },
    ],
    [
      "an image is inserted from a file, replaced, and deleted",
      async ({ session }) => {
        await clickByRole(session, {
          role: "button",
          name: await slideLabel(session, 2),
        });
        await waitForActive(session, 1);
        const [insertLabel, imageLabel, replaceLabel, deleteLabel] =
          await Promise.all(
            [
              "decks:actions.insertImage",
              "decks:editor.image",
              "decks:imageMenu.replace",
              "decks:imageMenu.delete",
            ].map((key) => translate(session, key)),
          );
        await chooseFile(session, fixture("swatch-3x2.png"), () =>
          clickByRole(session, { role: "button", name: insertLabel }),
        );
        const inserted = await waitForStageImage(session, 3);
        check(inserted.src === "blob:", "image served as a blob", inserted);
        check(Math.abs(inserted.ratio - 1.5) < 0.02, "aspect kept", inserted);
        check(Math.abs(inserted.centerX - 0.5) < 0.01, "centred", inserted);

        const [presenterButton, endLabel] = await Promise.all(
          ["decks:actions.presenterView", "decks:presenter.end"].map((key) =>
            translate(session, key),
          ),
        );
        await clickByRole(session, { role: "button", name: presenterButton });
        const audience = await session.openPage("window=deck-audience");
        try {
          await audience.waitUntil(
            () =>
              document.querySelector('main img[data-slide-item="image"]')
                ?.naturalWidth === 3,
            null,
            UI_TIMEOUT_MS,
          );
        } finally {
          audience.close();
        }
        await clickByRole(session, { role: "button", name: endLabel });
        await session.waitUntil(
          () => !document.querySelector('[role="dialog"]'),
          null,
          UI_TIMEOUT_MS,
        );

        const openImageMenu = () =>
          clickByRole(
            session,
            { role: "button", name: imageLabel },
            UI_TIMEOUT_MS,
            "right",
          );
        await openImageMenu();
        await chooseFile(session, fixture("photo-40x50.jpg"), () =>
          clickByRole(
            session,
            { role: "menuitem", name: replaceLabel },
            UI_TIMEOUT_MS,
          ),
        );
        const replaced = await waitForStageImage(session, 40);
        check(
          Math.abs(replaced.ratio - 0.8) < 0.02,
          "replacement fitted in the same frame",
          replaced,
        );

        await openImageMenu();
        await clickByRole(
          session,
          { role: "menuitem", name: deleteLabel },
          UI_TIMEOUT_MS,
        );
        await session.waitUntil(
          () =>
            !document.querySelector(
              'section > [data-slide-id] [data-slide-item="image"]',
            ),
          null,
          UI_TIMEOUT_MS,
        );
        return { inserted, replaced };
      },
    ],
    [
      "export menu offers PPTX and PDF",
      async ({ session }) => {
        const [exportLabel, pptx, pdf] = await Promise.all(
          [
            "decks:actions.export",
            "decks:actions.exportPptx",
            "decks:actions.exportPdf",
          ].map((key) => translate(session, key)),
        );
        await clickByRole(session, { role: "button", name: exportLabel });
        const items = await waitForRole(
          session,
          { role: "menuitem", name: new RegExp(`^(${pptx}|${pdf})$`) },
          UI_TIMEOUT_MS,
        );
        const names = items.map((item) => item.name).sort();
        check(names.length === 2, "export formats", names);
        await pressKey(session, "Escape");
        await session.waitUntil(
          () => !document.querySelector('[role="menu"]'),
          null,
          UI_TIMEOUT_MS,
        );
        return { names };
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
