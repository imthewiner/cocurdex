import {
  type JumpButtonKind,
  resolveJumpButton,
  type ScrollDirection,
} from "@cocurdex/shared";
import type { CondensedItem } from "./transcript-activity";

export interface ScrollMetrics {
  offset: number;
  contentHeight: number;
  viewportHeight: number;
}

export interface JumpState {
  kind: JumpButtonKind;
  direction: ScrollDirection;
  userScrolled: boolean;
  awayFromLatestAt: number | null;
}

export const INITIAL_JUMP_STATE: JumpState = {
  kind: null,
  direction: "down",
  userScrolled: false,
  awayFromLatestAt: null,
};

export function invertedScrollDirection(
  delta: number,
  current: ScrollDirection,
): ScrollDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return current;
}

export function transcriptEdges({
  offset,
  contentHeight,
  viewportHeight,
}: ScrollMetrics) {
  const threshold = viewportHeight;
  return {
    nearLatest: offset <= threshold,
    nearOldest: contentHeight - viewportHeight - offset <= threshold,
  };
}

export function nextJumpState(
  state: JumpState,
  metrics: ScrollMetrics,
  previousOffset: number,
  itemCount: number,
): JumpState {
  const direction = state.userScrolled
    ? invertedScrollDirection(metrics.offset - previousOffset, state.direction)
    : state.direction;
  const { nearLatest, nearOldest } = transcriptEdges(metrics);
  const kind = resolveJumpButton({
    isReady: itemCount > 0,
    hasUserScrolled: state.userScrolled,
    isNearTop: nearOldest,
    isNearBottom: nearLatest,
    scrollDirection: direction,
  });
  const awayFromLatestAt = nearLatest
    ? null
    : (state.awayFromLatestAt ?? itemCount);
  if (
    kind === state.kind &&
    direction === state.direction &&
    awayFromLatestAt === state.awayFromLatestAt
  ) {
    return state;
  }
  return { ...state, kind, direction, awayFromLatestAt };
}

export function hasUnseenLatest(state: JumpState, itemCount: number) {
  return state.awayFromLatestAt !== null && itemCount > state.awayFromLatestAt;
}

export interface PromptEntry {
  id: string;
  text: string;
  index: number;
}

export function promptOutline(items: readonly CondensedItem[]): PromptEntry[] {
  return items.flatMap((item, index) => {
    if (item.kind !== "user") return [];
    const firstLine = item.text.trim().split("\n")[0]?.trim() ?? "";
    return [{ id: item.id, text: firstLine, index }];
  });
}
