// Shared jump-button policy for agent chat and pure chat. Edges point to the
// opposite end; the middle mirrors scroll direction so the control always
// points where the viewer is already heading.

export type JumpButtonKind = "top" | "latest" | null;

export function resolveJumpButton({
  isReady,
  hasUserScrolled,
  isNearTop,
  isNearBottom,
  scrollDirection,
}: {
  isReady: boolean;
  hasUserScrolled: boolean;
  isNearTop: boolean;
  isNearBottom: boolean;
  scrollDirection: "up" | "down";
}): JumpButtonKind {
  if (!isReady || (isNearTop && isNearBottom)) {
    return null;
  }

  if (isNearTop) {
    return "latest";
  }

  if (isNearBottom) {
    // Suppressed until the viewer scrolls, so a freshly opened (auto-pinned to
    // bottom) conversation does not show a button it never asked for.
    return hasUserScrolled ? "top" : null;
  }

  return scrollDirection === "up" ? "top" : "latest";
}

export type ScrollDirection = "up" | "down";

export function scrollDirectionOfDelta(deltaY: number | undefined) {
  if (!deltaY) return null;
  return deltaY > 0 ? "down" : "up";
}

export function resolveScrollDirection({
  current,
  scrollDelta,
  inputDirection,
  hasRecentUserScrollIntent,
}: {
  current: ScrollDirection;
  scrollDelta: number;
  inputDirection: ScrollDirection | null;
  hasRecentUserScrollIntent: boolean;
}): ScrollDirection {
  if (!hasRecentUserScrollIntent) return current;
  return inputDirection ?? scrollDirectionOfDelta(scrollDelta) ?? current;
}
