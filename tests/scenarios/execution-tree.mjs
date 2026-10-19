import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clickByRole } from "./lib/locate.mjs";
import { openEditorPanel } from "./lib/navigate.mjs";

const DAEMON_CLIENT_MODULE = "/src/lib/daemon-client.ts";
const DIALOG_MODULE =
  "/src/features/agent/execution-tree/execution-tree-dialog.tsx";
const SESSION_ID = "scenario-execution-tree";
const LATEST_RUN_TIME = ":15:07";
const WORKER_TOOL_CALLS = 30;
const FAILED_OUTPUT_LINES = 30;
const PANEL_OPEN_TIMEOUT_MS = 60_000;
const SHELL_READY_TIMEOUT_MS = 60_000;

const LONG_PATHS = Array.from(
  { length: 8 },
  (_, index) => `packages/db/src/repositories/sqlite-repository-${index}.ts`,
).join(" ");

const args = readScenarioArgs();

function toolCall(id, title, status, startedAt, updatedAt) {
  return {
    toolCall: { id, title, kind: "exec", status, startedAt, updatedAt },
    subagent: null,
    child: null,
    observability: "full",
  };
}

function run(id, status, startedAt, endedAt, toolCalls) {
  return {
    run: {
      id,
      sessionId: SESSION_ID,
      triggerMessageId: `message-${id}`,
      status,
      startedAt,
      endedAt,
    },
    toolCalls,
    delegated: [],
    interactions: [],
  };
}

function childSession(id, toolCalls) {
  return {
    session: {
      id,
      title: id,
      agentType: "codex",
      sessionKind: "teammate",
      status: "idle",
      parentSessionId: SESSION_ID,
      parentToolCallId: null,
      createdAt: "2026-10-13T03:16:00.000Z",
      updatedAt: "2026-10-13T03:18:00.000Z",
    },
    runs: [],
    toolCalls,
    children: [],
    interactions: [],
    plan: null,
    truncated: false,
  };
}

function workerCalls(worker) {
  return Array.from({ length: WORKER_TOOL_CALLS }, (_, index) =>
    toolCall(
      `tool-${worker}-${index}`,
      `/bin/zsh -lc 'cat ${worker}-${index}.md'`,
      index === WORKER_TOOL_CALLS - 1 ? "failed" : "completed",
      "2026-10-13T03:16:01.000Z",
      "2026-10-13T03:16:01.300Z",
    ),
  );
}

const EXECUTION_TREE = {
  maxDepth: 4,
  root: {
    session: {
      id: SESSION_ID,
      title: "Desktop Release",
      agentType: "codex",
      sessionKind: "main",
      status: "running",
      parentSessionId: null,
      parentToolCallId: null,
      createdAt: "2026-10-13T03:00:00.000Z",
      updatedAt: "2026-10-13T03:15:07.000Z",
    },
    runs: [
      run(
        "run-earlier",
        "completed",
        "2026-10-13T03:00:00.000Z",
        "2026-10-13T03:02:14.000Z",
        [
          toolCall(
            "tool-earlier-status",
            "/bin/zsh -lc 'git status --short --branch'",
            "completed",
            "2026-10-13T03:00:01.000Z",
            "2026-10-13T03:00:01.400Z",
          ),
        ],
      ),
      run("run-latest", "running", "2026-10-13T03:15:07.000Z", null, [
        toolCall(
          "tool-latest-cat",
          "/bin/zsh -lc 'cat .agents/skills/desktop-release/SKILL.md'",
          "completed",
          "2026-10-13T03:15:08.000Z",
          "2026-10-13T03:15:08.200Z",
        ),
        toolCall(
          "tool-latest-failed",
          "/bin/zsh -lc 'gh release view --json tagName,isDraft,isPrerelease,url'",
          "failed",
          "2026-10-13T03:15:10.000Z",
          "2026-10-13T03:15:12.500Z",
        ),
        toolCall(
          "tool-latest-long",
          `/bin/zsh -lc 'rg -n "moveToEnd|assignRun|transaction" ${LONG_PATHS}'`,
          "completed",
          "2026-10-13T03:15:12.600Z",
          "2026-10-13T03:15:12.900Z",
        ),
        toolCall(
          "tool-latest-running",
          "/bin/zsh -lc 'git fetch origin main'",
          "in_progress",
          "2026-10-13T03:15:13.000Z",
          "2026-10-13T03:15:13.000Z",
        ),
      ]),
      run(
        "run-capacity",
        "failed",
        "2026-10-13T03:20:00.000Z",
        "2026-10-13T03:20:10.000Z",
        [],
      ),
    ],
    toolCalls: [],
    children: [
      childSession("worker-a", workerCalls("worker-a")),
      childSession("worker-b", workerCalls("worker-b")),
    ],
    interactions: [],
    plan: null,
    truncated: false,
  },
};

const FAILED_OUTPUT = Array.from(
  { length: FAILED_OUTPUT_LINES },
  (_, index) => `line ${index + 1}`,
)
  .concat("release not found")
  .join("\n");

async function readTree(session) {
  return session.run(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const rows = [...dialog.querySelectorAll("[data-execution-row]")].map(
      (row) => row.innerText.replace(/\s+/g, " ").trim(),
    );
    return {
      rows,
      text: dialog.innerText,
      pre: dialog.querySelector("pre")?.innerText ?? null,
    };
  });
}

function readDialogTop(session) {
  return session.run(
    () => document.querySelector('[role="dialog"]').getBoundingClientRect().top,
  );
}

function toggleSessionRow(session, sessionId) {
  return session.run((key) => {
    const toggle = document.querySelector(
      `[data-execution-row="${key}"] button[aria-expanded]`,
    );
    toggle?.click();
    return Boolean(toggle);
  }, `session:${sessionId}`);
}

function clickRow(session, fragment) {
  return clickByRole(session, {
    role: "button",
    name: fragment,
    exact: false,
    within: { role: "dialog" },
  });
}

runScenario("execution-tree", {
  open: () => openScenarioApp(args),
  async setup({ session }) {
    await session.waitUntil(
      async () =>
        Boolean(
          window.__scenario.byLabel(
            await window.__scenario.t("editor:actions.openEditorPanel"),
          ),
        ),
      null,
      SHELL_READY_TIMEOUT_MS,
    );
    await session.run(
      async ({ daemonClientModule, dialogModule, tree, output, sessionId }) => {
        const S = window.__scenario;
        const host = (await import(daemonClientModule)).getLocalHost();
        const request = host.request;
        window.__executionTreeRestore = () => {
          host.request = request;
        };
        host.request = (method, params, options) => {
          if (method === "session.executionTree") return Promise.resolve(tree);
          if (method === "session.getToolCallResult") {
            return Promise.resolve(
              params.toolCallId === "tool-latest-failed"
                ? { content: [{ type: "text", text: output }], rawOutput: null }
                : { content: [], rawOutput: null },
            );
          }
          return request.call(host, method, params, options);
        };
        const reactModule = await S.dep(dialogModule, "react");
        const domModule = await S.dep("/src/main.tsx", "react-dom_client");
        const React = reactModule.default ?? reactModule;
        const ReactDomClient = domModule.default ?? domModule;
        const { ExecutionTreeDialog } = await import(dialogModule);
        const container = document.createElement("div");
        document.body.append(container);
        const root = ReactDomClient.createRoot(container);
        window.__executionTreeUnmount = () => {
          root.unmount();
          container.remove();
        };
        root.render(
          React.createElement(ExecutionTreeDialog, {
            sessionId,
            onClose: () => window.__executionTreeUnmount(),
          }),
        );
        return true;
      },
      {
        daemonClientModule: DAEMON_CLIENT_MODULE,
        dialogModule: DIALOG_MODULE,
        tree: EXECUTION_TREE,
        output: FAILED_OUTPUT,
        sessionId: SESSION_ID,
      },
    );
    await session.waitUntil(
      () => document.querySelectorAll('[role="dialog"] li').length > 0,
    );
    return {};
  },
  steps: [
    [
      "commands-without-shell-wrapper",
      async ({ session }) => {
        const tree = await readTree(session);
        check(!tree.text.includes("/bin/zsh"), "shell wrapper still shown");
        check(
          tree.rows.some((row) => row.includes("gh release view --json")),
          "unwrapped command missing",
          tree.rows,
        );
        return { rows: tree.rows.length };
      },
    ],
    [
      "long-commands-stay-inside-dialog",
      async ({ session }) => {
        const layout = await session.run(() => {
          const dialog = document.querySelector('[role="dialog"]');
          const bounds = dialog.getBoundingClientRect();
          const toggle = dialog.querySelector('[role="switch"]');
          const firstRow = dialog.querySelector("li").getBoundingClientRect();
          const overflowing = [...dialog.querySelectorAll("li button")]
            .filter((button) => {
              const rect = button.getBoundingClientRect();
              return rect.right > bounds.right + 0.5;
            })
            .map((button) => button.innerText.trim());
          const toggleRect = toggle?.getBoundingClientRect();
          return {
            overflowing,
            toggleInside: Boolean(
              toggleRect &&
                toggleRect.left >= bounds.left &&
                toggleRect.right <= bounds.right &&
                toggleRect.bottom <= firstRow.top,
            ),
          };
        });
        check(
          layout.overflowing.length === 0,
          "rows overflow the dialog",
          layout,
        );
        check(layout.toggleInside, "issues-only toggle is off-screen", layout);
        return layout;
      },
    ],
    [
      "session-row-shows-agent-icon-and-name",
      async ({ session }) => {
        const row = await session.run(() => {
          const button = document.querySelector(
            '[data-execution-row^="session:"] button',
          );
          return {
            text: button.innerText.replace(/\s+/g, " ").trim(),
            icons: button.querySelectorAll("svg, img").length,
          };
        });
        check(row.text.endsWith("Codex"), "agent display name missing", row);
        check(row.icons >= 2, "agent icon missing", row);
        return row;
      },
    ],
    [
      "earlier-run-collapsed-with-summary",
      async ({ session }) => {
        const tree = await readTree(session);
        check(
          !tree.text.includes("git status --short"),
          "earlier run is expanded by default",
        );
        const runRow = tree.rows.find((row) => row.includes("2m 14s"));
        check(Boolean(runRow), "earlier run summary missing", tree.rows);
        check(
          tree.rows.some((row) => row.includes("2.5s") || row.includes("3s")),
          "tool duration missing",
          tree.rows,
        );
        await clickRow(session, "2m 14s");
        await session.waitUntil(() =>
          document
            .querySelector('[role="dialog"]')
            ?.innerText.includes("git status --short"),
        );
        const expanded = await readTree(session);
        check(
          expanded.text.includes("git status --short"),
          "earlier run did not expand",
        );
        return { runRow };
      },
    ],
    [
      "failed-tool-output",
      async ({ session }) => {
        await clickRow(session, "gh release view");
        await session.waitUntil(() =>
          Boolean(document.querySelector('[role="dialog"] pre')),
        );
        const tree = await readTree(session);
        check(
          tree.pre.trim().endsWith("release not found"),
          "output tail missing",
          tree.pre,
        );
        check(!tree.pre.includes("line 1\n"), "output was not tailed");
        return { outputLines: tree.pre.split("\n").length };
      },
    ],
    [
      "empty-run-has-no-expand-control",
      async ({ session }) => {
        const row = await session.run(() => {
          const item = document.querySelector(
            '[data-execution-row="run:run-capacity"]',
          );
          return item
            ? {
                text: item.innerText.replace(/\s+/g, " ").trim(),
                expandControls: item.querySelectorAll("[aria-expanded]").length,
              }
            : null;
        });
        check(Boolean(row), "empty run row missing");
        check(row.expandControls === 0, "empty run is expandable", row);
        return row;
      },
    ],
    [
      "subagents-folded-with-summary",
      async ({ session }) => {
        const tree = await readTree(session);
        check(
          !tree.text.includes("worker-a-0.md"),
          "subagent calls shown before expanding",
        );
        const worker = await session.run(() => {
          const row = document.querySelector(
            '[data-execution-row="session:worker-a"]',
          );
          return row
            ? {
                expanded: row
                  .querySelector("[aria-expanded]")
                  ?.getAttribute("aria-expanded"),
                text: row.innerText.replace(/\s+/g, " ").trim(),
              }
            : null;
        });
        check(Boolean(worker), "subagent row missing", tree.rows);
        check(worker.expanded === "false", "subagent expanded by default");
        check(worker.text.includes("30"), "subagent summary missing", worker);
        return worker;
      },
    ],
    [
      "sticky-session-headers",
      async ({ session }) => {
        check(
          await toggleSessionRow(session, "worker-a"),
          "subagent toggle missing",
        );
        await session.waitUntil(() =>
          document
            .querySelector('[role="dialog"]')
            ?.innerText.includes("worker-a-29.md"),
        );
        const layout = await session.run(async () => {
          const list = document.querySelector('[role="dialog"] ul');
          const lastCall = document.querySelector(
            '[data-execution-row="tool:tool-worker-a-28"]',
          );
          list.scrollTop =
            lastCall.offsetTop - list.clientHeight + lastCall.offsetHeight;
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const top = (key) =>
            document
              .querySelector(`[data-execution-row="${key}"]`)
              .getBoundingClientRect().top;
          const listTop = list.getBoundingClientRect().top;
          const result = {
            scrolled: list.scrollTop,
            root:
              document
                .querySelector('[data-execution-row^="session:"]')
                .getBoundingClientRect().top - listTop,
            worker: top("session:worker-a") - listTop,
          };
          list.scrollTop = 0;
          return result;
        });
        check(layout.scrolled > 0, "list did not scroll", layout);
        check(Math.abs(layout.root) < 1, "root header not pinned", layout);
        check(
          Math.abs(layout.worker - 28) < 1,
          "subagent header not pinned below root",
          layout,
        );
        await toggleSessionRow(session, "worker-a");
        await toggleSessionRow(session, "worker-b");
        await session.waitUntil(() =>
          document
            .querySelector('[role="dialog"]')
            ?.innerText.includes("worker-b-29.md"),
        );
        const overlap = await session.run(async () => {
          const list = document.querySelector('[role="dialog"] ul');
          const row = (key) =>
            document.querySelector(`[data-execution-row="${key}"]`);
          const listTop = list.getBoundingClientRect().top;
          list.scrollTop +=
            row("session:worker-a").getBoundingClientRect().top - listTop;
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const rootHeader = document.querySelector(
            '[data-execution-row^="session:"]',
          );
          const rect = rootHeader.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          const result = {
            scrolled: list.scrollTop,
            rootOnTop: rootHeader.contains(hit),
          };
          list.scrollTop = 0;
          return result;
        });
        check(overlap.scrolled > 0, "list did not scroll", overlap);
        check(
          overlap.rootOnTop,
          "a nested header covers the root header",
          overlap,
        );
        await toggleSessionRow(session, "worker-b");
        return { ...layout, ...overlap };
      },
    ],
    [
      "issues-only-filter",
      async ({ session }) => {
        const topBefore = await readDialogTop(session);
        const clicked = await session.run(() => {
          const toggle = document.querySelector(
            '[role="dialog"] [role="switch"]',
          );
          toggle?.click();
          return Boolean(toggle);
        });
        check(clicked, "issues-only switch missing");
        await session.waitUntil(
          () =>
            !document
              .querySelector('[role="dialog"]')
              ?.innerText.includes("git fetch origin main"),
        );
        const tree = await readTree(session);
        check(
          !tree.text.includes("git fetch origin main") &&
            !tree.text.includes("git status --short"),
          "issues-only kept healthy tool calls",
          tree.rows,
        );
        check(
          tree.text.includes("gh release view"),
          "issues-only dropped the failed call",
        );
        const topAfter = await readDialogTop(session);
        check(
          Math.abs(topAfter - topBefore) < 1,
          "dialog moved when filtering",
          { topBefore, topAfter },
        );
        return { rows: tree.rows.length, topBefore, topAfter };
      },
    ],
    [
      "collapse-run-while-filtering",
      async ({ session }) => {
        await clickRow(session, LATEST_RUN_TIME);
        await session.waitUntil(
          () =>
            !document
              .querySelector('[role="dialog"]')
              ?.innerText.includes("gh release view"),
        );
        return {};
      },
    ],
    [
      "no-runtime-errors",
      async ({ session }) => {
        const errors = await session.run(() => window.__scenario.errors);
        check(errors.length === 0, "renderer errors", errors);
        return {};
      },
    ],
    [
      "right-panel-close-button",
      async ({ session }) => {
        await session.run(async () => {
          window.__executionTreeUnmount?.();
          await window.__scenario.sleep(300);
          return true;
        });
        const labels = await session.run(async () => ({
          open: await window.__scenario.t("editor:actions.openEditorPanel"),
          close: await window.__scenario.t("editor:actions.closeEditorPanel"),
        }));
        await openEditorPanel(session);
        const panelClose = (labels) =>
          [
            ...document.querySelectorAll(
              `[aria-label="${CSS.escape(labels.close)}"]`,
            ),
          ].some((button) => !button.closest("header"));
        await session.waitUntil(panelClose, labels, PANEL_OPEN_TIMEOUT_MS);
        const result = await session.run(async (labels) => {
          const S = window.__scenario;
          const panelButton = () =>
            [
              ...document.querySelectorAll(
                `[aria-label="${CSS.escape(labels.close)}"]`,
              ),
            ].find((button) => !button.closest("header"));
          const button = panelButton();
          if (!button) return { found: false };
          button.click();
          await S.sleep(300);
          return {
            found: true,
            closed: Boolean(S.byLabel(labels.open)) && !panelButton(),
          };
        }, labels);
        check(result.found, "right panel close button missing");
        check(result.closed, "right panel did not close");
        return result;
      },
    ],
  ],
  async teardown({ session }) {
    await session.run(() => {
      window.__executionTreeUnmount?.();
      window.__executionTreeRestore?.();
      return true;
    });
    return {};
  },
});
