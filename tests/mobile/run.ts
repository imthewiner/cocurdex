import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  FIXTURE_ISSUES,
  FIXTURE_NOTES,
  FIXTURE_ROLES,
  FIXTURE_SESSIONS,
  FIXTURE_WORKSPACE_NAME,
} from "@cocurdex/e2e/fixture-db/recipe";
import type { SupportedLocale } from "@cocurdex/shared";
import { createTempDirs } from "@cocurdex/shared/testing";
import { androidSdk, buildAndroidApp, startAndroidTarget } from "./lib/android";
import { runCommand } from "./lib/command";
import { startPairingDaemon } from "./lib/daemon";
import { buildIosApp, startIosTarget } from "./lib/ios";
import type { Appearance, MobilePlatform, MobileTarget } from "./lib/target";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const mobileDir = path.join(repoRoot, "apps/mobile");
const flowsDir = path.join(import.meta.dirname, "flows");
const RUNS: { appearance: Appearance; locale: SupportedLocale }[] = [
  { appearance: "light", locale: "en-US" },
  { appearance: "dark", locale: "zh-CN" },
];
const SYSTEM_CONTINUE: Record<SupportedLocale, string> = {
  "en-US": "Continue",
  "zh-CN": "继续",
};
const SEARCH_OPEN: Record<SupportedLocale, string> = {
  "en-US": "Search",
  "zh-CN": "搜索",
};
const SEARCH_DISMISS: Record<SupportedLocale, string> = {
  "en-US": "Cancel|Close",
  "zh-CN": "取消|关闭",
};

function readMessages(locale: SupportedLocale, namespace: string) {
  const file = path.join(mobileDir, "src/locales", locale, `${namespace}.json`);
  return JSON.parse(readFileSync(file, "utf8"));
}

const SEARCHED_SESSION = "fixture-session-discounts";
const CODE_SESSION = "fixture-session-checkout-audit";
const TOOL_SESSION = "fixture-session-checkout-bug";
const DIAGRAM_SESSION = "fixture-session-checkout-diagrams";

function fixtureSession(id: string) {
  const session = FIXTURE_SESSIONS.find((candidate) => candidate.id === id);
  if (!session) throw new Error(`Fixture session ${id} is missing`);
  return session;
}

function lastPrompt(id: string) {
  const prompt = fixtureSession(id).turns.at(-1)?.prompt;
  if (!prompt) throw new Error(`Fixture session ${id} has no turns`);
  return prompt;
}

function firstTurn(id: string) {
  const turn = fixtureSession(id).turns[0];
  if (!turn) throw new Error(`Fixture session ${id} has no turns`);
  return turn;
}

function fixtureIssue(title: string) {
  const issue = FIXTURE_ISSUES.find((candidate) => candidate.title === title);
  if (!issue) throw new Error(`Fixture issue ${title} is missing`);
  return issue;
}

function fixtureNote(key: string) {
  const note = FIXTURE_NOTES.find((candidate) => candidate.key === key);
  if (!note) throw new Error(`Fixture note ${key} is missing`);
  return note;
}

const IMAGE_SESSION = {
  title: "Checkout screenshot review",
  prompt: "What is wrong on this checkout screen?",
  reply: "The order total overlaps the pay button.",
  imageName: "checkout-screenshot.png",
};

const LINK_NOTE_TITLE = "Discount rollout";

const OPENED_ISSUE = fixtureIssue("Support percentage discount codes");
const OPENED_NOTE = fixtureNote("checkout-spec");

function flowLabels(locale: SupportedLocale) {
  const hosts = readMessages(locale, "hosts");
  const common = readMessages(locale, "common");
  const sessions = readMessages(locale, "sessions");
  const issues = readMessages(locale, "issues");
  const notes = readMessages(locale, "notes");
  return {
    TAB_SETTINGS: common.tabs.settings,
    TAB_SESSIONS: common.tabs.sessions,
    TAB_ISSUES: common.tabs.issues,
    TAB_NOTES: common.tabs.notes,
    IN_PROGRESS_ISSUE_TITLE: fixtureIssue("Checkout fails for some carts")
      .title,
    ISSUE_TITLE: OPENED_ISSUE.title,
    ISSUE_DESCRIPTION: OPENED_ISSUE.description,
    ISSUE_SESSION_TITLE: fixtureSession(OPENED_ISSUE.linkedSessionId ?? "")
      .title,
    NOTE_PARENT_TITLE: fixtureNote(OPENED_NOTE.parentKey ?? "").title,
    NOTE_TITLE: OPENED_NOTE.title,
    NOTE_BODY_TEXT: "(?s).*Apply at most one discount code.*",
    SEARCH_PLACEHOLDER: sessions.search,
    LIST_OPTIONS_ACTION: sessions.list.menu,
    LIST_OPTIONS_DONE: sessions.list.options.done,
    SHOW_MORE: sessions.list.showMore_other.replace("{{count}}", "\\d+"),
    SEND_ACTION: sessions.composer.send,
    ATTACH_ACTION: sessions.composer.attach,
    WORKSPACE_NAME: FIXTURE_WORKSPACE_NAME,
    SEARCH_QUERY: "percentage",
    SEARCHED_SESSION_TITLE: fixtureSession(SEARCHED_SESSION).title,
    SEARCHED_SESSION_LAST_PROMPT: lastPrompt(SEARCHED_SESSION),
    SEARCHED_SESSION_FIRST_PROMPT: firstTurn(SEARCHED_SESSION).prompt,
    SEARCHED_SESSION_FIRST_PROMPT_ID: firstTurn(SEARCHED_SESSION).messageId,
    PROMPTS_ACTION: sessions.detail.prompts,
    OTHER_SESSION_TITLE: fixtureSession("fixture-session-checkout-bug").title,
    ROLE_ID: FIXTURE_ROLES[0].id,
    ROLE_NAME: FIXTURE_ROLES[0].name,
    CODE_SESSION_TITLE: fixtureSession(CODE_SESSION).title,
    CODE_BLOCK_TEXT: "(?s)const fulfillmentSteps = .*",
    TOOL_SESSION_TITLE: fixtureSession(TOOL_SESSION).title,
    DIAGRAM_SESSION_TITLE: fixtureSession(DIAGRAM_SESSION).title,
    DIAGRAM_PROMPT: "Draw each checkout stage as a flowchart.",
    DIAGRAM_HEADING: "1. Cart boundary",
    DIAGRAM_CLOSE: common.markdown.closeDiagram,
    IMAGE_SESSION_TITLE: IMAGE_SESSION.title,
    IMAGE_NAME: IMAGE_SESSION.imageName,
    IMAGE_CLOSE: sessions.image.close,
    TOOL_INPUT_TITLE: sessions.tool.input,
    FILE_LINK_TEXT: "(?s)(.*\\n)?.{0,2}src/cart\\.ts.{0,2}",
    FILE_SOURCE_TEXT: ".*function cartSubtotal.*",
    EMPTY_TITLE: hosts.empty.title,
    EMPTY_SCAN: hosts.empty.scan,
    SCAN_TITLE: hosts.scan.title,
    SCAN_PASTE: hosts.scan.paste,
    SCAN_UNREACHABLE: hosts.pair.failure.unreachable,
    PAIR_ACTION: hosts.pair.action,
    LINK_PLACEHOLDER: hosts.pair.linkPlaceholder,
    SYSTEM_CONTINUE: SYSTEM_CONTINUE[locale],
    SEARCH_OPEN: SEARCH_OPEN[locale],
    SEARCH_DISMISS: SEARCH_DISMISS[locale],
    NEW_SESSION_ACTION: sessions.newSession.open,
    NEW_SESSION_TITLE: sessions.newSession.title,
    NEW_ISSUE_ACTION: issues.create.open,
    NEW_ISSUE_SUBMIT: issues.create.submit,
    RENAME_COMPUTER_SAVE: hosts.rename.save,
    NEW_NOTE_ACTION: notes.create.open,
    NOTE_DONE: notes.editor.done,
    DEFAULT_NOTE_TITLE: "Untitled",
    ARCHIVE_ACTION: sessions.actions.archive,
    SESSION_CONFIG_DONE: sessions.sessionConfig.done,
    SAVE_ROLE_SAVE: sessions.saveRole.save,
  };
}

function sendLabels(locale: SupportedLocale) {
  return {
    SEND_SESSION_TITLE: `Mobile reply check ${locale}`,
    SEND_PROMPT: `Summarize the cart module ${locale}`,
    SEND_REPLY: `The cart module totals line items ${locale}`,
    SEND_REPLY_CODE: "let totalCents = 0",
    SEND_REPLY_END: `Totals are stored in cents ${locale}`,
    NEW_SESSION_PROMPT: `Review the checkout totals ${locale}`,
    NEW_ISSUE_TITLE: `Export last week's orders ${locale}`,
    RENAMED_COMPUTER: `Studio Mac ${locale}`,
    NEW_NOTE_TITLE: `Release checklist ${locale}`,
    NEW_NOTE_BODY: `Ship the order export ${locale}`,
  };
}

function streamedReply(send: ReturnType<typeof sendLabels>) {
  return [
    send.SEND_REPLY,
    "- Adds each **line total**\n- Applies the `discount` last",
    `\`\`\`ts\n${send.SEND_REPLY_CODE}\n\`\`\``,
    send.SEND_REPLY_END,
  ].join("\n\n");
}

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    platform: { type: "string" },
    build: { type: "boolean", default: false },
    avd: { type: "string" },
    keep: { type: "boolean", default: false },
  },
});

function parsePlatform(value: string | undefined): MobilePlatform {
  const requested =
    value ?? (process.platform === "darwin" ? "ios" : "android");
  if (requested !== "ios" && requested !== "android") {
    throw new Error(`--platform must be ios or android, not ${requested}`);
  }
  return requested;
}

const platform = parsePlatform(values.platform);
if (platform === "ios" && process.platform !== "darwin") {
  throw new Error("iOS runs need macOS with Xcode");
}

const DRIVER_STARTUP_TIMEOUT_MS = "240000";

async function runFlow(
  target: MobileTarget,
  flow: string,
  env: Record<string, string>,
  outputDir: string,
  daemonDiagnostics: () => Promise<string>,
) {
  const envArgs = Object.entries(env).flatMap(([key, value]) => [
    "-e",
    `${key}=${value}`,
  ]);
  try {
    await runCommand(
      "maestro",
      [
        "--device",
        target.deviceId,
        "test",
        ...envArgs,
        "--test-output-dir",
        outputDir,
        path.join(flowsDir, flow),
      ],
      {
        inherit: true,
        env: {
          MAESTRO_DRIVER_STARTUP_TIMEOUT: DRIVER_STARTUP_TIMEOUT_MS,
          ...process.env,
          ...(platform === "android" ? { ANDROID_HOME: androidSdk() } : {}),
        },
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const daemonState = await daemonDiagnostics();
    throw new Error(
      `${reason}\n${await target.diagnostics()}\n${daemonState}`,
      {
        cause: error,
      },
    );
  }
}

function flowOutputRoot(tempDirs: ReturnType<typeof createTempDirs>) {
  const artifactsDir = process.env.COCURDEX_TEST_ARTIFACTS_DIR;
  if (!artifactsDir) return tempDirs.createSync("cocu-mobile-");
  const outputRoot = path.join(artifactsDir, `mobile-${platform}`);
  mkdirSync(outputRoot, { recursive: true });
  return outputRoot;
}

async function main() {
  await runCommand("maestro", ["--version"]).catch(() => {
    throw new Error("Maestro CLI is missing; install it and Java 17+");
  });
  if (values.build) {
    await runCommand("pnpm", ["--filter", "@cocurdex/desktop", "prepare:cli"], {
      cwd: repoRoot,
      inherit: true,
    });
    await (platform === "ios"
      ? buildIosApp(mobileDir)
      : buildAndroidApp(mobileDir));
  }
  const tempDirs = createTempDirs();
  const outputRoot = flowOutputRoot(tempDirs);
  const daemon = await startPairingDaemon(platform, tempDirs);
  const openedSessionState = async () =>
    (await daemon.sessionAttention()).find(
      (entry) => entry.sessionId === CODE_SESSION,
    )?.attentionState;
  try {
    const before = await openedSessionState();
    if (before !== "completed-unread") {
      throw new Error(`${CODE_SESSION} should start unread, not ${before}`);
    }
    const target =
      platform === "ios"
        ? await startIosTarget(mobileDir)
        : await startAndroidTarget(mobileDir, values.avd);
    await daemon.createImageSession(
      IMAGE_SESSION.title,
      IMAGE_SESSION.prompt,
      IMAGE_SESSION.reply,
    );
    const issueLinkText = await daemon.createNoteLinkingIssue(
      LINK_NOTE_TITLE,
      OPENED_ISSUE.title,
    );
    try {
      for (const { appearance, locale } of RUNS) {
        const send = sendLabels(locale);
        const replySession = await daemon.createReplyingSession(
          send.SEND_SESSION_TITLE,
          streamedReply(send),
        );
        await target.resetState();
        await target.setAppearance(appearance);
        await target.setLocale(locale);
        await runFlow(
          target,
          "pairing.yaml",
          {
            ...flowLabels(locale),
            ...send,
            SEND_SESSION_ID: replySession.id,
            NEW_SESSION_MODEL: daemon.agentModelName,
            AGENT_MODEL_ID: daemon.agentModelId,
            PAIRING_LINK: await daemon.createPairingLink(),
            HOST_ADDRESS: daemon.hostAddress,
            LINK_NOTE_TITLE,
            ISSUE_LINK_TEXT: issueLinkText,
            RESTORE_ACTION: readMessages(
              locale,
              "sessions",
            ).archived.restoreSession.replace(
              "{{title}}",
              send.SEND_SESSION_TITLE,
            ),
          },
          path.join(outputRoot, `${appearance}-${locale}`),
          daemon.diagnostics,
        );
      }
      const after = await openedSessionState();
      if (after === "completed-unread") {
        throw new Error(`Opening ${CODE_SESSION} did not mark it visited`);
      }
      const prompts = daemon.sentPrompts().join("\n");
      for (const { locale } of RUNS) {
        const { SEND_PROMPT } = sendLabels(locale);
        if (!prompts.includes(SEND_PROMPT)) {
          throw new Error(`The agent never received "${SEND_PROMPT}"`);
        }
      }
      const replySessionTitles = RUNS.map(
        ({ locale }) => sendLabels(locale).SEND_SESSION_TITLE,
      );
      const started = (await daemon.sessions()).filter(
        (session) =>
          session.agentType === "pi" &&
          session.providerSnapshot?.modelName === daemon.agentModelName &&
          !replySessionTitles.includes(session.title),
      );
      if (started.length !== RUNS.length) {
        throw new Error(
          `Expected ${RUNS.length} sessions started on Pi with ${daemon.agentModelName}, found ${started.length}`,
        );
      }
      for (const { locale } of RUNS) {
        const { NEW_SESSION_PROMPT } = sendLabels(locale);
        if (!prompts.includes(NEW_SESSION_PROMPT)) {
          throw new Error(`The agent never received "${NEW_SESSION_PROMPT}"`);
        }
      }
      const devices = await daemon.pairedDevices();
      if (devices.length !== RUNS.length) {
        throw new Error(
          `Expected ${RUNS.length} paired devices, daemon has ${devices.length}`,
        );
      }
    } finally {
      await target.stop();
    }
    process.stdout.write(
      `${JSON.stringify({ platform, ok: true, screenshots: values.keep ? outputRoot : null })}\n`,
    );
  } finally {
    await daemon.dispose();
    if (!values.keep) await tempDirs.cleanup();
  }
}

await main();
