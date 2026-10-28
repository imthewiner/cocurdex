import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { clearColorScheme, emulateColorScheme } from "./lib/appearance.mjs";
import { daemonRequest } from "./lib/daemon-rpc.mjs";
import { clickByRole } from "./lib/locate.mjs";
import { translate } from "./lib/navigate.mjs";

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

function readingState() {
  const viewport = [
    ...document.querySelectorAll("[data-slot=scroll-area-viewport]"),
  ].find((node) => node.querySelector("[data-testid=chat-timeline]"));
  if (!viewport) return null;
  return {
    top: viewport.scrollTop,
    height: viewport.scrollHeight,
    viewport: viewport.clientHeight,
    length: viewport.textContent.length,
  };
}

function jumpControlLayout(label) {
  const button = [...document.querySelectorAll("button")].find(
    (node) => node.getAttribute("aria-label") === label,
  );
  const viewport = [
    ...document.querySelectorAll("[data-slot=scroll-area-viewport]"),
  ].find((node) => node.querySelector("[data-testid=chat-timeline]"));
  if (!button || !viewport) return null;
  const control = button.getBoundingClientRect();
  const area = viewport.getBoundingClientRect();
  return {
    endGap:
      viewport.closest("section").getBoundingClientRect().right - control.right,
    bottomGap: area.bottom - control.bottom,
    width: control.width,
    height: control.height,
  };
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
    [
      "stream growth preserves reading position before and after a manual jump",
      async ({ session, workspaceId, providerSnapshot }) => {
        const reports = [];
        const jumpLabel = await translate(session, "common:jumpToLatest");
        for (const theme of ["light", "dark"]) {
          await emulateColorScheme(session, theme);
          const title = `Reading control ${theme}`;
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
          const text = `${Array.from(
            { length: 70 },
            (_, index) =>
              `Reading section ${index + 1}. New content must not move the reader's viewport while this reply grows.\n\n`,
          ).join("")}Reading control finished.`;
          stub.plan = {
            kind: "stream",
            chunks: text.match(/[\s\S]{1,24}/g),
            intervalMs: 80,
          };
          await daemonRequest(session, "session.send", {
            sessionId: configured.id,
            messageId: crypto.randomUUID(),
            content: "Check manual reading control.",
            attachments: [],
          });
          await session.waitUntil(
            () => {
              const viewport = [
                ...document.querySelectorAll(
                  "[data-slot=scroll-area-viewport]",
                ),
              ].find((node) =>
                node.querySelector("[data-testid=chat-timeline]"),
              );
              return (
                viewport && viewport.scrollHeight > viewport.clientHeight * 1.5
              );
            },
            null,
            30_000,
          );
          const before = await session.run(readingState);
          await session.waitUntil(
            (length) => {
              const viewport = [
                ...document.querySelectorAll(
                  "[data-slot=scroll-area-viewport]",
                ),
              ].find((node) =>
                node.querySelector("[data-testid=chat-timeline]"),
              );
              return viewport && viewport.textContent.length > length + 400;
            },
            before.length,
            30_000,
          );
          const grown = await session.run(readingState);
          check(
            Math.abs(grown.top - before.top) <= 1,
            "stream moved the reading position",
            { before, grown },
          );
          const pulse = await session.run((label) => {
            const button = [...document.querySelectorAll("button")].find(
              (node) => node.getAttribute("aria-label") === label,
            );
            const icon = button?.querySelector("svg");
            return icon ? getComputedStyle(icon).animationName : null;
          }, jumpLabel);
          check(pulse === "pulse", "offscreen streaming icon is not animated", {
            pulse,
          });
          const jumpLayout = await session.run(jumpControlLayout, jumpLabel);
          check(
            jumpLayout && Math.abs(jumpLayout.endGap - 16) <= 1,
            "jump control must sit at the bottom end of the conversation",
            jumpLayout,
          );
          check(
            jumpLayout.bottomGap >= 12 && jumpLayout.bottomGap <= 24,
            "jump control must sit just above the composer",
            jumpLayout,
          );
          await clickByRole(session, { role: "button", name: jumpLabel });
          const jumped = await session.run(readingState);
          check(
            jumped.top > grown.top,
            "explicit jump did not reach new content",
            { grown, jumped },
          );
          await session.waitUntil(
            (length) => {
              const viewport = [
                ...document.querySelectorAll(
                  "[data-slot=scroll-area-viewport]",
                ),
              ].find((node) =>
                node.querySelector("[data-testid=chat-timeline]"),
              );
              return viewport && viewport.textContent.length > length + 400;
            },
            jumped.length,
            30_000,
          );
          const afterJump = await session.run(readingState);
          check(
            Math.abs(afterJump.top - jumped.top) <= 1,
            "manual jump rearmed automatic following",
            { jumped, afterJump },
          );
          await session.waitUntil(
            () =>
              document.body.textContent.includes("Reading control finished."),
            null,
            60_000,
          );
          await session.waitUntil(
            () => document.querySelectorAll("[data-streaming]").length === 0,
            null,
            30_000,
          );
          const stopped = await session.run((label) => {
            const button = [...document.querySelectorAll("button")].find(
              (node) => node.getAttribute("aria-label") === label,
            );
            const icon = button?.querySelector("svg");
            return icon ? getComputedStyle(icon).animationName : null;
          }, jumpLabel);
          check(stopped === "none", "completed reply kept the icon animated", {
            stopped,
          });
          const artifacts = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
          if (artifacts) {
            const shot = await session.send("Page.captureScreenshot", {
              format: "png",
            });
            await writeFile(
              path.join(artifacts, `jump-control-${theme}.png`),
              Buffer.from(shot.data, "base64"),
            );
          }
          const resizedLayouts = [];
          const topLabel = await translate(session, "common:jumpToTop");
          for (const width of [960, 1280]) {
            await session.send("Emulation.setDeviceMetricsOverride", {
              width,
              height: 800,
              deviceScaleFactor: 1,
              mobile: false,
            });
            await session.waitUntil(
              (width) => window.innerWidth === width,
              width,
            );
            await clickByRole(session, { role: "button", name: jumpLabel });
            const point = await session.run(() => {
              const area = [
                ...document.querySelectorAll(
                  "[data-slot=scroll-area-viewport]",
                ),
              ]
                .find((node) =>
                  node.querySelector("[data-testid=chat-timeline]"),
                )
                .getBoundingClientRect();
              return {
                x: area.x + area.width / 2,
                y: area.y + area.height / 2,
              };
            });
            await session.send("Input.dispatchMouseEvent", {
              type: "mouseWheel",
              ...point,
              deltaX: 0,
              deltaY: 20,
            });
            await session.waitUntil(
              (label) =>
                [...document.querySelectorAll("button")].some(
                  (node) => node.getAttribute("aria-label") === label,
                ),
              topLabel,
            );
            const topLayout = await session.run(jumpControlLayout, topLabel);
            check(
              Math.abs(topLayout.endGap - 16) <= 1 &&
                topLayout.bottomGap === 16,
              "top control must retain the bottom-end slot after resize",
              { width, topLayout },
            );
            await clickByRole(session, { role: "button", name: topLabel });
            await session.waitUntil(() => {
              const viewport = [
                ...document.querySelectorAll(
                  "[data-slot=scroll-area-viewport]",
                ),
              ].find((node) =>
                node.querySelector("[data-testid=chat-timeline]"),
              );
              return viewport?.scrollTop === 0;
            });
            const latestLayout = await session.run(
              jumpControlLayout,
              jumpLabel,
            );
            check(
              Math.abs(latestLayout.endGap - 16) <= 1 &&
                latestLayout.bottomGap === topLayout.bottomGap,
              "both directions must share the same slot",
              { width, topLayout, latestLayout },
            );
            resizedLayouts.push({ width, topLayout, latestLayout });
          }
          await session.send("Emulation.clearDeviceMetricsOverride");
          reports.push({
            theme,
            before,
            grown,
            jumped,
            afterJump,
            jumpLayout,
            resizedLayouts,
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
