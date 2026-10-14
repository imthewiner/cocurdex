import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole, waitForRole } from "./lib/locate.mjs";

const PINNED_SESSION = "Add percentage discount codes";
const LISTED_SESSION = "Store cart totals in cents";
const SESSION_WORKSPACE = { id: "fixture-acme-shop", name: "acme-shop" };
const OTHER_WORKSPACE = { id: "fixture-acme-suite", name: "acme-suite" };
const UI_TIMEOUT_MS = 30_000;
const POINTER_PARK = { x: 900, y: 300 };

const args = readScenarioArgs();

function readComposerWorkspaceId() {
  return (
    document.querySelector("[data-workspace-id]")?.dataset.workspaceId ?? null
  );
}

async function openSession(session, title) {
  await clickByRole(
    session,
    { role: "button", name: new RegExp(`^${title}\\s+(?![(（])`) },
    UI_TIMEOUT_MS,
  );
  await session.waitUntil(
    (title) =>
      Boolean(document.querySelector("[data-workspace-id]")) &&
      document.body.innerText.includes(title),
    title,
    UI_TIMEOUT_MS,
  );
}

async function setExpanded(session, workspace, expanded) {
  await clickByRole(session, { role: "button", name: workspace.name });
  await session.waitUntil(
    ({ name, expanded }) =>
      [...document.querySelectorAll("button[aria-expanded]")].some(
        (button) =>
          button.textContent === name &&
          button.getAttribute("aria-expanded") === String(expanded),
      ),
    { name: workspace.name, expanded },
    UI_TIMEOUT_MS,
  );
}

async function readRowFill(session, workspace) {
  const [row] = await waitForRole(session, {
    role: "button",
    name: new RegExp(`^${workspace.name} `),
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...POINTER_PARK,
  });
  await session.send("DOM.getDocument", { depth: 0 });
  const { object } = await session.send("DOM.resolveNode", {
    backendNodeId: row.backendNodeId,
  });
  const { result } = await session.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    returnByValue: true,
    awaitPromise: true,
    functionDeclaration: `async function () {
      await Promise.all(this.getAnimations().map((animation) => animation.finished));
      return getComputedStyle(this).backgroundColor;
    }`,
  });
  return result.value;
}

async function collapsedFill(session) {
  await setExpanded(session, SESSION_WORKSPACE, false);
  const active = await readRowFill(session, SESSION_WORKSPACE);
  const idle = await readRowFill(session, OTHER_WORKSPACE);
  await setExpanded(session, SESSION_WORKSPACE, true);
  const expanded = await readRowFill(session, SESSION_WORKSPACE);
  return { active, expanded, idle };
}

runScenario("workspace-sidebar", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    await openSession(session, PINNED_SESSION);
    return {};
  },
  steps: [
    [
      "toggling another workspace keeps the open session's workspace",
      async ({ session }) => {
        await setExpanded(session, OTHER_WORKSPACE, false);
        await setExpanded(session, OTHER_WORKSPACE, true);
        const composerWorkspaceId = await session.run(readComposerWorkspaceId);
        check(
          composerWorkspaceId === SESSION_WORKSPACE.id,
          "composer shows another workspace",
          { composerWorkspaceId },
        );
        return { composerWorkspaceId };
      },
    ],
    [
      "a pinned active session leaves its collapsed workspace unfilled",
      async ({ session }) => {
        const fill = await collapsedFill(session);
        check(
          fill.active === fill.idle,
          "workspace duplicates selection",
          fill,
        );
        return fill;
      },
    ],
    [
      "a collapsed workspace hiding the active session carries the fill",
      async ({ session }) => {
        await openSession(session, LISTED_SESSION);
        const fill = await collapsedFill(session);
        check(fill.active !== fill.idle, "hidden selection has no fill", fill);
        check(
          fill.expanded === fill.idle,
          "expanded workspace is filled",
          fill,
        );
        return fill;
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
