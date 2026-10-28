import { resolveJumpButton, resolveScrollDirection } from "@cocurdex/shared";
import { describe, expect, it } from "vitest";

describe("resolveJumpButton", () => {
  const base = {
    isReady: true,
    hasUserScrolled: true,
    isNearTop: false,
    isNearBottom: false,
    scrollDirection: "down" as const,
  };

  it("shows nothing until the view is ready", () => {
    expect(resolveJumpButton({ ...base, isReady: false })).toBeNull();
  });

  it("shows nothing when content fits (near both edges)", () => {
    expect(
      resolveJumpButton({ ...base, isNearTop: true, isNearBottom: true }),
    ).toBeNull();
  });

  it("offers 'latest' at the top", () => {
    expect(resolveJumpButton({ ...base, isNearTop: true })).toBe("latest");
  });

  it("offers 'top' at the bottom once the viewer has scrolled", () => {
    expect(resolveJumpButton({ ...base, isNearBottom: true })).toBe("top");
  });

  it("stays hidden at the bottom of a freshly opened conversation", () => {
    expect(
      resolveJumpButton({
        ...base,
        isNearBottom: true,
        hasUserScrolled: false,
      }),
    ).toBeNull();
  });

  it("mirrors the scroll direction in the middle", () => {
    expect(resolveJumpButton({ ...base, scrollDirection: "up" })).toBe("top");
    expect(resolveJumpButton({ ...base, scrollDirection: "down" })).toBe(
      "latest",
    );
  });
});

describe("resolveScrollDirection", () => {
  const base = {
    current: "up" as const,
    scrollDelta: 0,
    inputDirection: null,
    hasRecentUserScrollIntent: true,
  };

  it("follows the wheel even when layout compensation pushes scrollTop down", () => {
    expect(
      resolveScrollDirection({
        ...base,
        scrollDelta: 457,
        inputDirection: "up",
      }),
    ).toBe("up");
  });

  it("ignores scrolls the viewer did not cause", () => {
    expect(
      resolveScrollDirection({
        ...base,
        scrollDelta: 300,
        hasRecentUserScrollIntent: false,
      }),
    ).toBe("up");
  });

  it("uses the scroll delta for input without a direction", () => {
    expect(resolveScrollDirection({ ...base, scrollDelta: 120 })).toBe("down");
    expect(
      resolveScrollDirection({ ...base, current: "down", scrollDelta: -120 }),
    ).toBe("up");
  });

  it("keeps the direction when the viewport did not move", () => {
    expect(resolveScrollDirection({ ...base, current: "down" })).toBe("down");
  });
});

it("prioritizes incoming content only while running", () => {
  const state = {
    isReady: true,
    hasUserScrolled: true,
    isNearTop: false,
    isNearBottom: false,
    scrollDirection: "up" as const,
  };
  expect(resolveJumpButton({ ...state, streaming: true })).toBe("latest");
  expect(resolveJumpButton({ ...state, streaming: false })).toBe("top");
});
