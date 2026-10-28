import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clearColorScheme, emulateColorScheme } from "./lib/appearance.mjs";
import { daemonRequest } from "./lib/daemon-rpc.mjs";
import { clickByRole } from "./lib/locate.mjs";

const require = createRequire(new URL("../e2e/package.json", import.meta.url));
const { tsImport } = await import(require.resolve("tsx/esm/api"));
const { startStubLlmServer } = await tsImport(
  require.resolve("@cocurdex/e2e/helpers/llm-stub"),
  import.meta.url,
);
const { createProviderSnapshotForModel } = await tsImport(
  require.resolve("@cocurdex/shared"),
  import.meta.url,
);
const args = readScenarioArgs();
const answer = `Stream verification begins. ${"中文与 emoji 👩🏽‍💻 remain readable. ".repeat(12)} Stream verification finished.`;
let stub;

function startRecorder() {
  const record = { frames: [], nodes: new Set(), done: false };
  window.__streamRecorder = record;
  const sample = () => {
    const node = [...document.querySelectorAll("article p")].find((el) =>
      el.textContent.startsWith("Stream verification begins."),
    );
    if (node) {
      record.nodes.add(node);
      record.frames.push({
        at: performance.now(),
        length: node.textContent.length,
        fading: node.querySelectorAll("[data-stream-fade]").length,
      });
    }
    if (!record.done) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

runScenario("chat-streaming", {
  open: () => openScenarioApp(args, { fixtureDb: true }),
  setup: async ({ session }) => {
    stub = await startStubLlmServer();
    const now = new Date().toISOString();
    const provider = {
      id: "stream-scenario",
      name: "Stream scenario",
      baseUrl: stub.baseUrl,
      enabled: true,
      apiKeySecretId: null,
      headersJson: JSON.stringify({ Authorization: "Bearer synthetic-key" }),
      createdAt: now,
      updatedAt: now,
    };
    const model = {
      providerId: provider.id,
      modelId: "stream-model",
      name: "Stream model",
      api: "openai-completions",
      enabled: true,
      source: "manual",
      capabilities: ["chat", "agent"],
      createdAt: now,
      updatedAt: now,
    };
    await daemonRequest(session, "provider.config.save", { config: provider });
    await daemonRequest(session, "provider.model.save", { model });
    const workspaces = await daemonRequest(session, "workspace.list");
    const workspace =
      workspaces.find((item) => item.name === "acme-shop") ?? workspaces[0];
    return {
      workspaceId: workspace.id,
      providerSnapshot: createProviderSnapshotForModel({ provider, model }),
    };
  },
  steps: [
    [
      "continuous streams remain current and retain their paragraph through completion in both themes",
      async ({ session, workspaceId, providerSnapshot }) => {
        const reports = [];
        for (const theme of ["light", "dark"]) {
          await emulateColorScheme(session, theme);
          const title = `Streaming ${theme}`;
          const configured = await daemonRequest(session, "session.configure", {
            id: crypto.randomUUID(),
            workspaceId,
            sessionKind: "main",
            title,
            agentType: "pi",
            writeMode: "read-only",
            sessionModeId: null,
            providerSnapshot,
          });
          await clickByRole(
            session,
            { role: "button", name: new RegExp(`^${title}`) },
            30_000,
          );
          await session.waitUntil(
            () =>
              ![...document.querySelectorAll("article p")].some((node) =>
                node.textContent.startsWith("Stream verification begins."),
              ),
            null,
            30_000,
          );
          stub.plan = {
            kind: "script",
            turns: [
              {
                text: ["Checking the fixture."],
                toolCalls: [
                  { name: "read", arguments: { path: "package.json" } },
                ],
              },
              {
                text: [
                  ...new Intl.Segmenter(undefined, {
                    granularity: "grapheme",
                  }).segment(answer),
                ].map((part) => part.segment),
                intervalMs: 16,
              },
            ],
          };
          await session.run(startRecorder);
          await daemonRequest(session, "session.send", {
            sessionId: configured.id,
            messageId: crypto.randomUUID(),
            content: "Read the fixture and stream the result.",
            attachments: [],
          });
          await session.waitUntil(
            () =>
              document.body.textContent.includes(
                "Stream verification finished.",
              ),
            null,
            30_000,
          );
          await session.waitUntil(
            () => document.querySelectorAll("[data-streaming]").length === 0,
            null,
            30_000,
          );
          const report = await session.run(() => {
            const record = window.__streamRecorder;
            record.done = true;
            return {
              frames: record.frames,
              nodes: record.nodes.size,
              errors: window.__scenario.errors,
            };
          });
          check(
            report.frames.length > 10,
            "stream did not render progressively",
            report,
          );
          check(
            report.nodes === 1,
            "answer paragraph remounted at completion",
            report,
          );
          const first = report.frames[0];
          const last = report.frames.at(-1);
          check(
            first.length < answer.length / 2,
            "first paint waited for most of the answer",
            { first, last },
          );
          check(last.length === answer.length, "stream lost content", {
            last,
            expected: answer.length,
          });
          check(report.errors.length === 0, "renderer errors", report.errors);
          const maxGrowth = Math.max(
            ...report.frames
              .slice(1)
              .map(
                (frame, index) => frame.length - report.frames[index].length,
              ),
          );
          const maxFading = Math.max(
            ...report.frames.map((frame) => frame.fading),
          );
          check(maxGrowth < 80, "stream accumulated a large visible jump", {
            maxGrowth,
          });
          check(
            maxFading <= 8,
            "stream accumulated too many active fade fragments",
            { maxFading },
          );
          const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
          if (artifacts) {
            await mkdir(artifacts, { recursive: true });
            const shot = await session.send("Page.captureScreenshot", {
              format: "png",
            });
            await writeFile(
              path.join(artifacts, `chat-streaming-${theme}.png`),
              Buffer.from(shot.data, "base64"),
            );
          }
          reports.push({
            theme,
            frames: report.frames.length,
            firstLength: first.length,
            finalLength: last.length,
            paragraphMounts: report.nodes,
            maxGrowth,
            maxFading,
          });
        }
        await clearColorScheme(session);
        return { themes: reports };
      },
    ],
  ],
  teardown: async () => {
    await stub?.close();
    return {};
  },
});
