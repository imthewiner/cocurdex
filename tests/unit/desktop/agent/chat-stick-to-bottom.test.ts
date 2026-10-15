import { describe, expect, it } from "vitest";
import { resolveStickToBottom } from "@/features/agent/view/chat-scroll";

const base = {
  hasRecentUserScrollIntent: false,
  isAtBottom: true,
  isNearBottom: true,
  scrollDelta: 0,
  wasSticking: true,
};

describe("resolveStickToBottom", () => {
  it("keeps following while the viewer stays at the bottom", () => {
    expect(resolveStickToBottom(base)).toBe(true);
  });

  it("stops following a nudge inside the sticky band while scrolling", () => {
    // The regression: a scroll of a few dozen pixels is still "near bottom",
    // and re-arming there yanked the viewer back down on the next chunk.
    expect(
      resolveStickToBottom({
        ...base,
        hasRecentUserScrollIntent: true,
        isAtBottom: false,
      }),
    ).toBe(false);
  });

  it("re-arms when the viewer scrolls back to the very bottom", () => {
    expect(
      resolveStickToBottom({
        ...base,
        hasRecentUserScrollIntent: true,
        wasSticking: false,
      }),
    ).toBe(true);
  });

  it("stays detached after scrolling away once the intent window lapses", () => {
    expect(
      resolveStickToBottom({
        ...base,
        isAtBottom: false,
        isNearBottom: false,
        wasSticking: false,
      }),
    ).toBe(false);
  });

  it("detaches when the viewport moves up out of the bottom band without intent", () => {
    expect(
      resolveStickToBottom({
        ...base,
        isAtBottom: false,
        isNearBottom: false,
        scrollDelta: -400,
      }),
    ).toBe(false);
  });

  it("keeps following when content growth moves the viewport down", () => {
    expect(
      resolveStickToBottom({
        ...base,
        isAtBottom: false,
        isNearBottom: false,
        scrollDelta: 400,
      }),
    ).toBe(true);
  });
});
