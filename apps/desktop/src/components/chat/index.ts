// Cross-feature chat primitives. Lives outside features/ on purpose:
// both features/chat (pure chat) and features/agent import from here.
// Keep this module small and dependency-free — anything that pulls Jotai
// atoms or feature-specific types belongs in the feature.
export { CollapsibleUserMessageBody } from "./collapsible-user-message-body";
export type { JumpButtonKind, ScrollDirection } from "./jump-button";
export {
  resolveJumpButton,
  resolveScrollDirection,
  scrollDirectionOfDelta,
} from "./jump-button";
export { JumpControls } from "./jump-controls";
export { LinkifiedText } from "./linkified-text";
export {
  isScrollNearBottom,
  isScrollNearTop,
  STICK_TO_BOTTOM_RESUME_THRESHOLD,
  STICK_TO_BOTTOM_THRESHOLD,
  shouldFollowStreamOnResize,
  shouldReleaseStickOnUserScroll,
} from "./use-stick-to-bottom";
export { clampOffset, useVerticalDrag } from "./use-vertical-drag";
