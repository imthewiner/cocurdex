export const STICK_TO_BOTTOM_THRESHOLD = 96;
export const STICK_TO_BOTTOM_RESUME_THRESHOLD = 8;

export function isScrollNearBottom(
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
  threshold = STICK_TO_BOTTOM_THRESHOLD,
): boolean {
  return scrollHeight - clientHeight - scrollTop <= threshold;
}

export function isScrollNearTop(
  scrollTop: number,
  threshold = STICK_TO_BOTTOM_THRESHOLD,
): boolean {
  return scrollTop <= threshold;
}

export function shouldReleaseStickOnUserScroll({
  isAtBottom,
  deltaY,
}: {
  isAtBottom: boolean;
  deltaY?: number;
}): boolean {
  if (!isAtBottom) {
    return true;
  }
  return typeof deltaY === "number" && deltaY < 0;
}

export function shouldFollowStreamOnResize({
  isAtBottom,
  isLocked,
  suppressFollow,
}: {
  isAtBottom: boolean;
  isLocked: boolean;
  suppressFollow: boolean;
}): boolean {
  if (suppressFollow) {
    return false;
  }
  return isLocked || isAtBottom;
}
