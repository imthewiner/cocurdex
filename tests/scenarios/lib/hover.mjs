import { setTimeout as delay } from "node:timers/promises";

const TOOLTIP_DELAY_MS = 900;

export async function nodeCenter(session, backendNodeId) {
  await session.send("DOM.getDocument", { depth: 0 });
  await session.send("DOM.scrollIntoViewIfNeeded", { backendNodeId });
  const { model } = await session.send("DOM.getBoxModel", { backendNodeId });
  const [left, top, , , right, bottom] = model.border;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export async function hoverUntilTooltipOpens(session, point, timeoutMs) {
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x + 400,
    y: point.y,
  });
  await delay(100);
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...point,
  });
  await delay(TOOLTIP_DELAY_MS);
  await session.waitUntil(
    () =>
      document
        .querySelector('[data-slot="tooltip-content"]')
        ?.hasAttribute("data-open") ?? false,
    null,
    timeoutMs,
  );
}

export function readOpenTooltip() {
  const popup = document.querySelector(
    '[data-slot="tooltip-content"][data-open]',
  );
  const lines = popup.innerText.split("\n").filter(Boolean);
  return { lines, width: popup.getBoundingClientRect().width };
}
