import type { CondensedItem } from "@cocurdex/mobile/internal/session-detail/transcript-activity";
import {
  hasUnseenLatest,
  INITIAL_JUMP_STATE,
  isFarFromLatest,
  isFarFromOldest,
  isNearVisibleItems,
  type JumpState,
  nextJumpState,
  promptOutline,
} from "@cocurdex/mobile/internal/session-detail/transcript-jump";
import { describe, expect, it } from "vitest";

const VIEWPORT = 800;
const CONTENT = 10_000;

function at(offset: number) {
  return { offset, contentHeight: CONTENT, viewportHeight: VIEWPORT };
}

const scrolled: JumpState = { ...INITIAL_JUMP_STATE, userScrolled: true };

describe("nextJumpState", () => {
  it("shows nothing on a freshly opened transcript at the latest message", () => {
    expect(nextJumpState(INITIAL_JUMP_STATE, at(0), 0, 20).kind).toBeNull();
  });

  it("offers the oldest message after the viewer scrolls near the latest", () => {
    expect(nextJumpState(scrolled, at(100), 0, 20).kind).toBe("top");
  });

  it("mirrors the scroll direction in the middle of a long transcript", () => {
    const towardOlder = nextJumpState(scrolled, at(4000), 3000, 20);
    expect(towardOlder.kind).toBe("top");
    const towardLatest = nextJumpState(towardOlder, at(3000), 4000, 20);
    expect(towardLatest.kind).toBe("latest");
  });

  it("offers the latest message from the oldest end", () => {
    const oldest = CONTENT - VIEWPORT;
    expect(nextJumpState(scrolled, at(oldest), oldest - 50, 20).kind).toBe(
      "latest",
    );
  });

  it("shows nothing when the transcript fits on screen", () => {
    const short = { offset: 0, contentHeight: 600, viewportHeight: VIEWPORT };
    expect(nextJumpState(scrolled, short, 0, 3).kind).toBeNull();
  });

  it("keeps the same state object when nothing changed", () => {
    const state = nextJumpState(scrolled, at(4000), 3000, 20);
    expect(nextJumpState(state, at(4100), 4000, 20)).toBe(state);
  });
});

describe("hasUnseenLatest", () => {
  it("flags items that arrived while the viewer was away from the latest", () => {
    const away = nextJumpState(scrolled, at(4000), 3000, 20);
    expect(hasUnseenLatest(away, 20)).toBe(false);
    expect(hasUnseenLatest(away, 21)).toBe(true);
  });

  it("clears once the viewer is back at the latest message", () => {
    const away = nextJumpState(scrolled, at(4000), 3000, 20);
    const back = nextJumpState(away, at(0), 4000, 22);
    expect(hasUnseenLatest(back, 22)).toBe(false);
  });
});

describe("promptOutline", () => {
  it("lists user prompts by their first line with their transcript index", () => {
    const items: CondensedItem[] = [
      { kind: "user", id: "u1", text: "  Review totals\nin cents", images: [] },
      {
        kind: "assistant",
        id: "a1",
        text: "Done",
        streaming: false,
        turnEnd: true,
      },
      { kind: "user", id: "u2", text: "Ship it", images: [] },
    ];
    expect(promptOutline(items)).toEqual([
      { id: "u1", text: "Review totals", index: 0 },
      { id: "u2", text: "Ship it", index: 2 },
    ]);
  });
});

describe("jump distance", () => {
  const viewport = 800;

  it("animates only within one screen of the latest", () => {
    expect(
      isFarFromLatest({
        offset: 5000,
        contentHeight: 9000,
        viewportHeight: viewport,
      }),
    ).toBe(true);
    expect(
      isFarFromLatest({
        offset: 600,
        contentHeight: 9000,
        viewportHeight: viewport,
      }),
    ).toBe(false);
  });

  it("animates only within one screen of the oldest", () => {
    expect(
      isFarFromOldest({
        offset: 100,
        contentHeight: 9000,
        viewportHeight: viewport,
      }),
    ).toBe(true);
    expect(
      isFarFromOldest({
        offset: 7800,
        contentHeight: 9000,
        viewportHeight: viewport,
      }),
    ).toBe(false);
  });
});

describe("isNearVisibleItems", () => {
  it("animates to an item a few rows from the visible ones", () => {
    expect(isNearVisibleItems(12, { first: 8, last: 10 })).toBe(true);
    expect(isNearVisibleItems(9, { first: 8, last: 10 })).toBe(true);
    expect(isNearVisibleItems(6, { first: 8, last: 10 })).toBe(true);
  });

  it("jumps without animation to a far item", () => {
    expect(isNearVisibleItems(40, { first: 0, last: 2 })).toBe(false);
    expect(isNearVisibleItems(0, { first: 30, last: 33 })).toBe(false);
  });

  it("jumps without animation before any row is visible", () => {
    expect(isNearVisibleItems(1, null)).toBe(false);
  });
});
