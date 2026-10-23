import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clearColorScheme, emulateColorScheme } from "./lib/appearance.mjs";
import { clickByRole } from "./lib/locate.mjs";
import { openSettingsSection, translate } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const SCRIPT =
  'if [ -f package.json ]; then\n  pnpm install # deps\nfi\necho "ready"';

const args = readScenarioArgs();

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readHighlight(label) {
  const textarea = document.querySelector(`textarea[aria-label="${label}"]`);
  const layer = textarea?.parentElement.querySelector("pre[aria-hidden]");
  const spans = [...(layer?.querySelectorAll("span") ?? [])];
  const keyword = spans.find((span) => span.textContent.trim() === "if");
  const comment = spans.find((span) => span.textContent.includes("# deps"));
  const string = spans.find((span) => span.textContent.includes('"ready"'));
  if (!keyword || !comment || !string) return null;
  return {
    layerText: layer.textContent,
    value: textarea.value,
    keyword: getComputedStyle(keyword).color,
    comment: getComputedStyle(comment).color,
    string: getComputedStyle(string).color,
  };
}

runScenario("script-field-highlight", {
  open: () => openScenarioApp(args),
  setup: async ({ session, workspaceRoot }) => {
    await openSettingsSection(session, "workspaces");
    const workspaceName = escapeRegExp(path.basename(workspaceRoot));
    const worktreeSettings = escapeRegExp(
      await translate(session, "settings:workspaces.worktreeSettings"),
    );
    await clickByRole(
      session,
      {
        role: "button",
        name: new RegExp(`^${workspaceName}\\b.*${worktreeSettings}$`),
      },
      UI_TIMEOUT_MS,
    );
    const label = await translate(session, "settings:worktrees.setupTitle");
    await clickByRole(session, { role: "textbox", name: label }, UI_TIMEOUT_MS);
    await session.send("Input.insertText", { text: SCRIPT });
    return { label };
  },
  steps: [
    [
      "a shell script is highlighted under the textarea in both themes",
      async ({ session, label }) => {
        const results = {};
        for (const theme of ["light", "dark"]) {
          await emulateColorScheme(session, theme);
          await session.waitUntil(readHighlight, label, UI_TIMEOUT_MS);
          const highlight = await session.run(readHighlight, label);
          check(
            highlight.layerText === highlight.value,
            "highlight layer text differs from the textarea",
            highlight,
          );
          check(
            new Set([highlight.keyword, highlight.comment, highlight.string])
              .size === 3,
            "keyword, comment, and string share colors",
            highlight,
          );
          results[theme] = highlight;
        }
        check(
          results.light.keyword !== results.dark.keyword,
          "keyword color does not follow the theme",
          results,
        );
        await clearColorScheme(session);
        return results;
      },
    ],
  ],
  teardown: async () => ({}),
});
