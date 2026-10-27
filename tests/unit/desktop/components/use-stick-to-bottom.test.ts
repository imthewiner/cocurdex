import { describe, expect, it } from "vitest";
import {
  isScrollNearBottom,
  isScrollNearTop,
  STICK_TO_BOTTOM_THRESHOLD,
  shouldFollowStreamOnResize,
  shouldReleaseStickOnUserScroll,
} from "@/components/chat";

describe("isScrollNearBottom", () => {
  it("is near bottom within the threshold", () => {
    expect(isScrollNearBottom(1000, 400, 600)).toBe(true);
    expect(
      isScrollNearBottom(1000, 400, 1000 - 400 - STICK_TO_BOTTOM_THRESHOLD),
    ).toBe(true);
  });

  it("is not near bottom past the threshold", () => {
    expect(
      isScrollNearBottom(1000, 400, 1000 - 400 - STICK_TO_BOTTOM_THRESHOLD - 1),
    ).toBe(false);
    expect(isScrollNearBottom(1000, 400, 0)).toBe(false);
  });
});

describe("isScrollNearTop", () => {
  it("is near the top within the threshold", () => {
    expect(isScrollNearTop(0)).toBe(true);
    expect(isScrollNearTop(STICK_TO_BOTTOM_THRESHOLD)).toBe(true);
  });

  it("is not near the top past the threshold", () => {
    expect(isScrollNearTop(STICK_TO_BOTTOM_THRESHOLD + 1)).toBe(false);
  });
});

describe("shouldReleaseStickOnUserScroll", () => {
  it("releases when the viewer is not at the bottom", () => {
    expect(shouldReleaseStickOnUserScroll({ isAtBottom: false })).toBe(true);
    expect(
      shouldReleaseStickOnUserScroll({ isAtBottom: false, deltaY: 40 }),
    ).toBe(true);
  });

  it("keeps the lock at the bottom for downward or unknown gestures", () => {
    expect(shouldReleaseStickOnUserScroll({ isAtBottom: true })).toBe(false);
    expect(
      shouldReleaseStickOnUserScroll({ isAtBottom: true, deltaY: 40 }),
    ).toBe(false);
    expect(
      shouldReleaseStickOnUserScroll({ isAtBottom: true, deltaY: 0 }),
    ).toBe(false);
  });

  it("releases at the bottom only when scrolling up", () => {
    expect(
      shouldReleaseStickOnUserScroll({ isAtBottom: true, deltaY: -12 }),
    ).toBe(true);
  });
});

describe("shouldFollowStreamOnResize", () => {
  it("follows while locked", () => {
    expect(
      shouldFollowStreamOnResize({
        isAtBottom: false,
        isLocked: true,
        suppressFollow: false,
      }),
    ).toBe(true);
  });

  it("re-follows at the very bottom even after the lock dropped", () => {
    expect(
      shouldFollowStreamOnResize({
        isAtBottom: true,
        isLocked: false,
        suppressFollow: false,
      }),
    ).toBe(true);
  });

  it("does not yank a reader who left the bottom", () => {
    expect(
      shouldFollowStreamOnResize({
        isAtBottom: false,
        isLocked: false,
        suppressFollow: false,
      }),
    ).toBe(false);
  });

  it("never follows mid jump-to-top", () => {
    expect(
      shouldFollowStreamOnResize({
        isAtBottom: true,
        isLocked: true,
        suppressFollow: true,
      }),
    ).toBe(false);
  });
});
