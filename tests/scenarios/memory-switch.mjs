import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { daemonRequest } from "./lib/daemon-rpc.mjs";
import { translate } from "./lib/navigate.mjs";

const UI_TIMEOUT_MS = 30_000;
const args = readScenarioArgs();

function switchSelector(label) {
  const escaped = label.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `[role="switch"][aria-label="${escaped}"]`;
}

async function openComposerMenu(session, attachLabel) {
  await session.waitUntil(
    (name) =>
      [...document.querySelectorAll("button")].some(
        (entry) => entry.getAttribute("aria-label") === name,
      ),
    attachLabel,
    UI_TIMEOUT_MS,
  );
  const opened = await session.run((name) => {
    const button = [...document.querySelectorAll("button")].find(
      (entry) => entry.getAttribute("aria-label") === name,
    );
    if (!button) return false;
    button.click();
    return true;
  }, attachLabel);
  check(opened, "composer attach menu is clickable");
}

async function readMemoryItem(session, label) {
  return session.run(
    ({ label }) => {
      const element = [
        ...document.querySelectorAll('[role="menuitemcheckbox"]'),
      ].find((entry) => (entry.textContent ?? "").includes(label));
      return element
        ? {
            checked: element.getAttribute("aria-checked"),
            disabled: element.getAttribute("data-disabled") !== null,
          }
        : null;
    },
    { label },
  );
}

async function clickMemoryItem(session, label) {
  return session.run(
    ({ label }) => {
      const element = [
        ...document.querySelectorAll('[role="menuitemcheckbox"]'),
      ].find((entry) => (entry.textContent ?? "").includes(label));
      if (!element || element.getAttribute("data-disabled") !== null) {
        return false;
      }
      element.click();
      return true;
    },
    { label },
  );
}

async function waitForMemoryItem(session, label, checked) {
  await session.waitUntil(
    ({ label, expected }) => {
      const element = [
        ...document.querySelectorAll('[role="menuitemcheckbox"]'),
      ].find((entry) => (entry.textContent ?? "").includes(label));
      return element?.getAttribute("aria-checked") === expected;
    },
    { label, expected: checked },
    UI_TIMEOUT_MS,
  );
}

async function readSwitch(session, label) {
  return session.run(
    ({ selector }) => {
      const element = document.querySelector(selector);
      return element
        ? {
            checked: element.getAttribute("aria-checked"),
            disabled: element.disabled === true,
          }
        : null;
    },
    { selector: switchSelector(label) },
  );
}

async function ensureMemoryItem(session, label, attachLabel) {
  const present = await session.run(
    ({ label }) =>
      [...document.querySelectorAll('[role="menuitemcheckbox"]')].some(
        (element) => (element.textContent ?? "").includes(label),
      ),
    { label },
  );
  if (!present) {
    await openComposerMenu(session, attachLabel);
  }
}

async function dismissOnboarding(session) {
  const skip = await translate(session, "onboarding:action.skip");
  const attach = await translate(session, "common:actions.attach");
  await session.waitUntil(
    ({ skip, attach }) => {
      const buttons = [...document.querySelectorAll("button")];
      return (
        buttons.some((entry) => entry.innerText.trim() === skip) ||
        buttons.some((entry) => entry.getAttribute("aria-label") === attach)
      );
    },
    { skip, attach },
    UI_TIMEOUT_MS,
  );
  await session.run((name) => {
    const button = [...document.querySelectorAll("button")].find(
      (entry) => entry.innerText.trim() === name,
    );
    button?.click();
  }, skip);
}

runScenario("memory-switch", {
  open: () => openScenarioApp(args),
  setup: async ({ session }) => {
    await dismissOnboarding(session);
    const label = await translate(session, "memory:switch.label");
    const attachLabel = await translate(session, "common:actions.attach");
    await openComposerMenu(session, attachLabel);
    await session.waitUntil(
      ({ label }) =>
        [...document.querySelectorAll('[role="menuitemcheckbox"]')].some(
          (element) => (element.textContent ?? "").includes(label),
        ),
      { label },
      UI_TIMEOUT_MS,
    );
    return { label, attachLabel };
  },
  steps: [
    [
      "the composer memory toggle is on by default",
      async ({ session, label }) => {
        const state = await readMemoryItem(session, label);
        check(state?.checked === "true", "memory toggle defaults on", state);
        const settings = await daemonRequest(session, "memory.settings.get");
        check(
          settings.enabled === true,
          "daemon setting defaults on",
          settings,
        );
        return { state };
      },
    ],
    [
      "turning memory off persists",
      async ({ session, label, attachLabel }) => {
        await ensureMemoryItem(session, label, attachLabel);
        check(
          await clickMemoryItem(session, label),
          "memory toggle is clickable",
        );
        await waitForMemoryItem(session, label, "false");
        const settings = await daemonRequest(session, "memory.settings.get");
        check(settings.enabled === false, "daemon setting is off", settings);
        return { enabled: settings.enabled };
      },
    ],
    [
      "turning memory back on persists",
      async ({ session, label, attachLabel }) => {
        await ensureMemoryItem(session, label, attachLabel);
        check(
          await clickMemoryItem(session, label),
          "memory toggle is clickable",
        );
        await waitForMemoryItem(session, label, "true");
        const settings = await daemonRequest(session, "memory.settings.get");
        check(settings.enabled === true, "daemon setting is on", settings);
        return { enabled: settings.enabled };
      },
    ],
    [
      "the memory settings section exposes the master switch",
      async ({ session }) => {
        const settingsLabel = await translate(
          session,
          "sessions:sidebar.settings",
        );
        const opened = await session.run((name) => {
          const button = [...document.querySelectorAll("button")].find(
            (entry) => entry.getAttribute("aria-label") === name,
          );
          if (!button) return false;
          button.click();
          return true;
        }, settingsLabel);
        if (opened) {
          await session.waitUntil(
            () =>
              document.body.innerText.includes("界面") ||
              document.body.innerText.includes("Agent"),
            null,
            UI_TIMEOUT_MS,
          );
        }
        const sectionName = await translate(
          session,
          "settings:sections.memory",
        );
        const clickedSection = await session.run((name) => {
          const button = [...document.querySelectorAll("button")].find(
            (entry) => entry.innerText.trim() === name,
          );
          if (!button) return false;
          button.click();
          return true;
        }, sectionName);
        check(clickedSection, "memory settings section is clickable");
        await session.waitUntil(
          (name) => document.querySelector("h1")?.innerText === name,
          sectionName,
          UI_TIMEOUT_MS,
        );
        const label = await translate(session, "memory:settings.enabled.title");
        await session.waitUntil(
          ({ selector }) => Boolean(document.querySelector(selector)),
          { selector: switchSelector(label) },
          UI_TIMEOUT_MS,
        );
        const state = await readSwitch(session, label);
        check(state?.checked === "true", "master switch is on", state);
        const doctor = await session.run(() =>
          [...document.querySelectorAll("button")].some(
            (button) =>
              button.innerText.trim() === "运行体检" ||
              button.innerText.trim() === "Run doctor",
          ),
        );
        check(doctor, "doctor action is available");
        return { state };
      },
    ],
  ],
  teardown: async ({ session }) => {
    const settings = await daemonRequest(session, "memory.settings.get");
    await daemonRequest(session, "memory.settings.set", {
      settings: { ...settings, enabled: true },
    });
  },
});
