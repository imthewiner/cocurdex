import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import {
  centerOf,
  clickByRole,
  clickPoint,
  waitForNoRole,
  waitForRole,
} from "./lib/locate.mjs";
import { openSettingsSection, translate } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const STATUS_TIMEOUT_MS = 60_000;
const PRODUCT_API_MODULE = "/src/lib/product-api.ts";
const EMPTY_CONFIG = '{\n  "mcpServers": {}\n}\n';
const FIXTURE_SERVER = createRequire(import.meta.url).resolve(
  "../e2e/fixtures/mcp-stdio-server.mjs",
);

const args = readScenarioArgs();

function quoteArg(value) {
  return /[\s"'\\]/.test(value)
    ? `"${value.replace(/(["\\])/g, "\\$1")}"`
    : value;
}

function resetMcpConfig(session) {
  return session.run(
    async ({ productApiModule, content }) => {
      const { daemonProductApi } = await import(productApiModule);
      await daemonProductApi.saveMcpConfig(content);
      return true;
    },
    { productApiModule: PRODUCT_API_MODULE, content: EMPTY_CONFIG },
  );
}

function readMcpConfig(session) {
  return session.run(async (productApiModule) => {
    const { daemonProductApi } = await import(productApiModule);
    return JSON.parse((await daemonProductApi.readMcpConfig()).content);
  }, PRODUCT_API_MODULE);
}

async function fillTextbox(session, name, value) {
  const [field] = await waitForRole(
    session,
    { role: "textbox", name },
    UI_TIMEOUT_MS,
  );
  await clickPoint(session, await centerOf(session, field.backendNodeId));
  await session.run(
    (text) => window.__scenario.setInput(document.activeElement, text),
    value,
  );
}

function serverDotLabel(name) {
  return document
    .querySelector(`[data-mcp-server="${name}"] [role="img"]`)
    ?.getAttribute("aria-label");
}

function readLayout(searchLabel) {
  const rectOf = (element) => element?.getBoundingClientRect() ?? null;
  const search = rectOf(window.__scenario.byLabel(searchLabel));
  const detail = rectOf(document.querySelector("[data-mcp-detail]"));
  const rows = [...document.querySelectorAll("[data-mcp-server]")].map(
    (row) => {
      const rect = row.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    },
  );
  const scroller =
    document.querySelector("[data-mcp-detail]")?.parentElement?.parentElement;
  return {
    searchTop: search?.top ?? null,
    detailTop: detail?.top ?? null,
    listRight: rows[0]?.right ?? null,
    detailLeft: detail?.left ?? null,
    rows,
    pageOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    detailOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
  };
}

async function capture(session, theme) {
  const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
  if (!artifacts) return null;
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
  });
  await mkdir(artifacts, { recursive: true });
  const file = path.join(artifacts, `mcp-settings-${theme}.png`);
  await writeFile(file, Buffer.from(data, "base64"));
  return file;
}

runScenario("mcp-settings", {
  open: () => openScenarioApp(args),
  setup: async ({ session }) => {
    await resetMcpConfig(session);
    await openSettingsSection(session, "mcp");
    const t = (key, options) => translate(session, `settings:${key}`, options);
    return { t };
  },
  steps: [
    [
      "the page opens with an empty server list",
      async ({ session, t }) => {
        const empty = await t("mcp.list.empty");
        await session.waitUntil(
          (text) => document.body.innerText.includes(text),
          empty,
          UI_TIMEOUT_MS,
        );
        await waitForRole(session, {
          role: "button",
          name: await t("mcp.list.importFromAgents"),
        });
        return {};
      },
    ],
    [
      "adding a local server saves it and lists its tools",
      async ({ session, t }) => {
        await clickByRole(session, {
          role: "button",
          name: await t("mcp.list.add"),
        });
        await fillTextbox(session, await t("mcp.fields.name"), "fixture");
        await fillTextbox(
          session,
          await t("mcp.fields.command"),
          process.execPath,
        );
        await fillTextbox(
          session,
          await t("mcp.fields.args"),
          quoteArg(FIXTURE_SERVER),
        );
        await clickByRole(session, {
          role: "button",
          name: await t("mcp.actions.save"),
        });
        await session.waitUntil(
          () => Boolean(document.querySelector('[data-mcp-tool="echo"]')),
          null,
          STATUS_TIMEOUT_MS,
        );
        const config = await readMcpConfig(session);
        check(
          config.mcpServers.fixture?.command === process.execPath,
          "saved command",
          config,
        );
        const dot = await session.run(serverDotLabel, "fixture");
        check(dot === (await t("mcp.state.connected")), "list status", dot);
        return { dot };
      },
    ],
    [
      "the Enabled switch writes the config immediately",
      async ({ session, t }) => {
        await clickByRole(session, {
          role: "switch",
          name: await t("mcp.detail.enabled"),
        });
        const disabled = await t("mcp.state.disabled");
        await session.waitUntil(
          ({ name, label }) =>
            document
              .querySelector(`[data-mcp-server="${name}"] [role="img"]`)
              ?.getAttribute("aria-label") === label,
          { name: "fixture", label: disabled },
          UI_TIMEOUT_MS,
        );
        const config = await readMcpConfig(session);
        check(
          config.mcpServers.fixture.enabled === false,
          "enabled flag",
          config,
        );
        await clickByRole(session, {
          role: "switch",
          name: await t("mcp.detail.enabled"),
        });
        await session.waitUntil(
          ({ name, label }) =>
            document
              .querySelector(`[data-mcp-server="${name}"] [role="img"]`)
              ?.getAttribute("aria-label") === label,
          { name: "fixture", label: await t("mcp.state.connected") },
          STATUS_TIMEOUT_MS,
        );
        return {};
      },
    ],
    [
      "pasted JSON imports a remote server after confirmation",
      async ({ session, t }) => {
        await clickByRole(session, {
          role: "button",
          name: await translate(session, "settings:jsonImport.pasteButton"),
        });
        const [field] = await waitForRole(session, {
          role: "textbox",
          name: await translate(session, "settings:jsonImport.pasteLabel"),
        });
        await clickPoint(session, await centerOf(session, field.backendNodeId));
        await session.send("Input.insertText", {
          text: '"remote": { "url": "https://mcp.example.invalid/mcp" }',
        });
        await clickByRole(session, {
          role: "button",
          name: await translate(session, "settings:jsonImport.continue"),
        });
        await clickByRole(
          session,
          {
            role: "button",
            name: await t("mcp.import.confirm", { count: 1 }),
          },
          UI_TIMEOUT_MS,
        );
        await session.waitUntil(
          () =>
            Boolean(document.querySelector('[data-mcp-server="remote"]')) &&
            !document.querySelector('[role="dialog"]'),
          null,
          UI_TIMEOUT_MS,
        );
        await session.waitUntil(
          () => document.querySelector("[data-mcp-detail]")?.dataset.mcpDetail,
          null,
          UI_TIMEOUT_MS,
        );
        const selected = await session.run(
          () => document.querySelector("[data-mcp-detail]").dataset.mcpDetail,
        );
        check(selected === "remote", "imported server selected", selected);
        await waitForRole(session, {
          role: "button",
          name: await t("mcp.auth.oauth"),
        });
        const config = await readMcpConfig(session);
        check(
          config.mcpServers.remote?.url === "https://mcp.example.invalid/mcp",
          "imported config",
          config,
        );
        return {};
      },
    ],
    [
      "JSON mode refuses to save invalid JSON",
      async ({ session, t }) => {
        await clickByRole(session, {
          role: "button",
          name: await t("mcp.mode.json"),
        });
        const [editor] = await waitForRole(session, {
          role: "textbox",
          name: await t("mcp.json.label"),
        });
        await clickPoint(
          session,
          await centerOf(session, editor.backendNodeId),
        );
        await session.send("Input.insertText", { text: "{" });
        await waitForRole(session, { role: "alert" });
        const save = await session.run(
          (label) =>
            [...document.querySelectorAll("button")].find(
              (button) => button.textContent.trim() === label,
            )?.disabled,
          await t("mcp.actions.save"),
        );
        check(save === true, "save stays disabled", save);
        await clickByRole(session, {
          role: "button",
          name: await t("mcp.mode.form"),
        });
        await session.waitUntil(
          () => Boolean(document.querySelector("[data-mcp-detail]")),
          null,
          UI_TIMEOUT_MS,
        );
        return {};
      },
    ],
    [
      "the two columns align and nothing overflows in both themes",
      async ({ session, t }) => {
        const searchLabel = await t("mcp.list.search");
        const results = {};
        for (const theme of ["light", "dark"]) {
          await session.run(
            (value) => window.__cocurdexDebug.previewTheme(value),
            theme,
          );
          await session.waitUntil(
            () =>
              document
                .getAnimations()
                .every((animation) => animation.playState !== "running"),
            null,
            UI_TIMEOUT_MS,
          );
          const layout = await session.run(readLayout, searchLabel);
          check(
            Math.abs(layout.searchTop - layout.detailTop) < 0.5,
            "list and detail tops differ",
            layout,
          );
          check(
            layout.listRight < layout.detailLeft,
            "columns overlap",
            layout,
          );
          check(
            new Set(layout.rows.map((row) => row.left)).size === 1 &&
              new Set(layout.rows.map((row) => row.right)).size === 1,
            "rows misaligned",
            layout,
          );
          check(layout.pageOverflow === 0, "page overflows", layout);
          check(layout.detailOverflow === 0, "detail overflows", layout);
          results[theme] = {
            ...layout,
            screenshot: await capture(session, theme),
          };
        }
        await session.run(() => window.__cocurdexDebug.restoreTheme());
        return results;
      },
    ],
    [
      "removing a server asks for confirmation",
      async ({ session, t }) => {
        const [row] = await waitForRole(session, {
          role: "button",
          name: /^fixture/,
        });
        await clickPoint(session, await centerOf(session, row.backendNodeId));
        await session.waitUntil(
          () =>
            document.querySelector("[data-mcp-detail]")?.dataset.mcpDetail ===
            "fixture",
          null,
          UI_TIMEOUT_MS,
        );
        await clickByRole(session, {
          role: "button",
          name: await t("mcp.actions.remove"),
        });
        await clickByRole(session, {
          role: "button",
          name: await t("mcp.removeConfirm.confirm"),
          within: { role: "dialog" },
        });
        await session.waitUntil(
          () => !document.querySelector('[data-mcp-server="fixture"]'),
          null,
          UI_TIMEOUT_MS,
        );
        await waitForNoRole(session, { role: "dialog" });
        const config = await readMcpConfig(session);
        check(!("fixture" in config.mcpServers), "server removed", config);
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
  teardown: async ({ session }) => {
    await resetMcpConfig(session);
    return {};
  },
});
