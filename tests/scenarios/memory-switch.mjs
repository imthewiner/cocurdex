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

async function clickSwitch(session, label) {
  return session.run(
    ({ selector }) => {
      const element = document.querySelector(selector);
      if (!element || element.disabled) return false;
      element.click();
      return true;
    },
    { selector: switchSelector(label) },
  );
}

async function waitForSwitch(session, label, checked) {
  await session.waitUntil(
    ({ selector, expected }) => {
      const element = document.querySelector(selector);
      return (
        element?.getAttribute("aria-checked") === expected &&
        element.disabled !== true
      );
    },
    { selector: switchSelector(label), expected: checked },
    UI_TIMEOUT_MS,
  );
}

async function dismissOnboarding(session) {
  const skip = await translate(session, "onboarding:action.skip");
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
    await session.waitUntil(
      ({ selector }) => Boolean(document.querySelector(selector)),
      { selector: switchSelector(label) },
      UI_TIMEOUT_MS,
    );
    return { label };
  },
  steps: [
    [
      "the welcome switch is on by default",
      async ({ session, label }) => {
        const state = await readSwitch(session, label);
        check(state?.checked === "true", "memory switch defaults on", state);
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
      async ({ session, label }) => {
        check(await clickSwitch(session, label), "memory switch is clickable");
        await waitForSwitch(session, label, "false");
        const settings = await daemonRequest(session, "memory.settings.get");
        check(settings.enabled === false, "daemon setting is off", settings);
        return { enabled: settings.enabled };
      },
    ],
    [
      "turning memory back on persists",
      async ({ session, label }) => {
        check(await clickSwitch(session, label), "memory switch is clickable");
        await waitForSwitch(session, label, "true");
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
