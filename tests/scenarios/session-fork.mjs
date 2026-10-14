import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole, clickPoint, waitForRole } from "./lib/locate.mjs";

const DAEMON_CLIENT_MODULE = "/src/lib/daemon-client.ts";
const SOURCE_TITLE = "Add percentage discount codes";
const FIRST_PROMPT = "Add support for percentage discount codes";
const SECOND_PROMPT = "Does the README mention discounts?";
const CHAT_TITLE = "Debounce vs throttle";
const UI_TIMEOUT_MS = 30_000;

const args = readScenarioArgs();

async function translate(session, key, options) {
  return session.run(({ key, options }) => window.__scenario.t(key, options), {
    key,
    options,
  });
}

async function daemon(session, method, params) {
  return session.run(
    async ({ modulePath, method, params }) =>
      (await import(modulePath)).getLocalHost().request(method, params),
    { modulePath: DAEMON_CLIENT_MODULE, method, params },
  );
}

async function boxCenter(session, backendNodeId) {
  await session.send("DOM.getDocument", { depth: 0 });
  await session.send("DOM.scrollIntoViewIfNeeded", { backendNodeId });
  const { model } = await session.send("DOM.getBoxModel", { backendNodeId });
  const [left, top, , , right, bottom] = model.border;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

async function openSession(session, title) {
  await clickByRole(session, {
    role: "button",
    name: new RegExp(`^${title}`),
  });
  await session.waitUntil(
    (text) => document.body.innerText.includes(text),
    title === SOURCE_TITLE ? SECOND_PROMPT : "debounce",
    UI_TIMEOUT_MS,
  );
}

runScenario("session-fork", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    await waitForRole(
      session,
      { role: "button", name: new RegExp(`^${SOURCE_TITLE}`) },
      UI_TIMEOUT_MS,
    );
    return {
      forkLabel: await translate(session, "sessions:lineage.forkFromHere"),
      forkTitle: await translate(session, "sessions:lineage.forkTitle", {
        title: SOURCE_TITLE,
      }),
    };
  },
  steps: [
    [
      "forking from the first turn opens a fork of that turn",
      async ({ session, forkLabel, forkTitle }) => {
        await openSession(session, SOURCE_TITLE);
        const buttons = await waitForRole(
          session,
          { role: "button", name: forkLabel },
          UI_TIMEOUT_MS,
        );
        const point = await boxCenter(session, buttons[0].backendNodeId);
        await session.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          ...point,
        });
        await clickPoint(session, point);
        await waitForRole(
          session,
          { role: "button", name: new RegExp(`^${forkTitle}`) },
          UI_TIMEOUT_MS,
        );
        const sessions = await daemon(session, "session.list");
        const fork = sessions.find((record) => record.title === forkTitle);
        check(
          fork,
          "fork session missing",
          sessions.map(({ title }) => title),
        );
        const { messages } = await daemon(session, "session.listMessages", {
          sessionId: fork.id,
        });
        const contents = messages.map(({ content }) => content);
        check(
          contents.some((content) => content.startsWith(FIRST_PROMPT)),
          "fork lost the first turn",
          contents,
        );
        check(
          !contents.includes(SECOND_PROMPT),
          "fork kept the later turn",
          contents,
        );
        const transfers = await daemon(session, "session.contextTransfers", {
          sessionId: fork.id,
        });
        const [transfer] = transfers;
        check(
          transfers.length === 1 &&
            transfer.kind === "fork" &&
            transfer.status === "pending" &&
            transfer.sourceSessionId === "fixture-session-discounts",
          "fork has no pending transfer from the source",
          transfers,
        );
        await session.waitUntil(
          (text) =>
            document.body.innerText.includes(text.first) &&
            !document.body.innerText.includes(text.second),
          { first: FIRST_PROMPT, second: SECOND_PROMPT },
          UI_TIMEOUT_MS,
        );
        return {
          copiedMessages: contents.length,
          transfer: transfer.status,
        };
      },
    ],
    [
      "chat sessions offer no fork from a message",
      async ({ session, forkLabel }) => {
        const chatTab = await translate(session, "chat:sidebar.title");
        await clickByRole(session, { role: "tab", name: chatTab });
        await openSession(session, CHAT_TITLE);
        const count = await session.run(
          (label) =>
            document.querySelectorAll(`[aria-label="${label}"]`).length,
          forkLabel,
        );
        check(count === 0, "chat session shows fork buttons", { count });
        return { forkButtons: count };
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
