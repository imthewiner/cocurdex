import { type RefObject, useCallback, useRef, useState } from "react";
import {
  resolveScrollDirection,
  type ScrollDirection,
  scrollDirectionOfDelta,
  shouldFollowStreamOnResize,
  shouldReleaseStickOnUserScroll,
} from "@/components/chat";
import {
  isViewportAtBottom,
  isViewportNearBottom,
  isViewportNearTop,
  resolveStickToBottom,
  resolveStickyUserMessage,
  type StickyUserMessageCandidate,
} from "./chat-scroll";
import type { UserMessageAnchor } from "./chat-user-navigation";
import type { ChatTimelineScrollHandle } from "./virtual-timeline";

const USER_SCROLL_INTENT_WINDOW_MS = 600;
const DISCLOSURE_HOLD_MS = 400;
function getMountedUserMessageTop(
  element: HTMLDivElement,
  viewport: HTMLDivElement,
) {
  const elementRect = element.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();

  if (
    elementRect.top !== 0 ||
    elementRect.height > 0 ||
    viewportRect.top !== 0
  ) {
    return viewport.scrollTop + (elementRect.top - viewportRect.top);
  }

  if (element.offsetTop > 0 || element.offsetHeight > 0) {
    return element.offsetTop;
  }

  return null;
}

export function useChatScrollState({
  timelineScrollRef,
  userMessageRefs,
  viewportRef,
}: {
  timelineScrollRef?: RefObject<ChatTimelineScrollHandle | null>;
  userMessageRefs: RefObject<Record<string, HTMLDivElement | null>>;
  viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isNearTop, setIsNearTop] = useState(true);
  // Last hand-scroll direction. In the middle region the jump button mirrors
  // it: scrolling up offers "back to top", scrolling down offers "to latest".
  const [scrollDirection, setScrollDirection] =
    useState<ScrollDirection>("down");
  const lastScrollTopRef = useRef(0);
  const inputDirectionRef = useRef<ScrollDirection | null>(null);
  // Latches once the viewer scrolls by hand. Gates the jump-to-top button so a
  // freshly opened conversation (auto-pinned to the bottom) does not show it
  // until the viewer has actually moved the viewport themselves.
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [stickyUserMessageId, setStickyUserMessageId] = useState<string | null>(
    null,
  );
  const [pendingUserMessageId, setPendingUserMessageId] = useState<
    string | null
  >(null);
  const pendingUserMessageIdRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);
  const shouldStickToBottomRef = useRef(true);
  const userScrollIntentTsRef = useRef(0);
  // While a smooth jump is in flight the viewport sweeps across both
  // thresholds, which would otherwise flash the sibling jump button into view
  // mid-animation. Hide the controls until the jump settles at its target.
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const autoScrollTargetRef = useRef<"bottom" | null>(null);

  const endAutoScroll = useCallback(() => {
    autoScrollTargetRef.current = null;
    setIsAutoScrolling(false);
  }, []);

  const setNearBottomState = useCallback((nextIsNearBottom: boolean) => {
    if (isNearBottomRef.current === nextIsNearBottom) {
      return;
    }

    isNearBottomRef.current = nextIsNearBottom;
    setIsNearBottom(nextIsNearBottom);
  }, []);

  const setStickyUserMessageState = useCallback((messageId: string | null) => {
    setStickyUserMessageId((currentMessageId) =>
      currentMessageId === messageId ? currentMessageId : messageId,
    );
  }, []);

  const clearPendingUserMessage = useCallback(() => {
    pendingUserMessageIdRef.current = null;
    setPendingUserMessageId(null);
  }, []);

  const syncScrollState = useCallback(
    (stickyUserMessages: UserMessageAnchor[]) => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const nextIsNearBottom = isViewportNearBottom(viewport);
      const nextIsNearTop = isViewportNearTop(viewport);
      setIsNearTop(nextIsNearTop);

      const hasRecentUserScrollIntent =
        performance.now() - userScrollIntentTsRef.current <
        USER_SCROLL_INTENT_WINDOW_MS;
      const scrollTop = viewport.scrollTop;
      const scrollDelta = scrollTop - lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;
      setScrollDirection((current) =>
        resolveScrollDirection({
          current,
          scrollDelta,
          inputDirection: inputDirectionRef.current,
          hasRecentUserScrollIntent,
        }),
      );

      if (autoScrollTargetRef.current === "bottom" && nextIsNearBottom) {
        endAutoScroll();
      }

      setNearBottomState(nextIsNearBottom);
      shouldStickToBottomRef.current =
        !timelineScrollRef?.current?.hasNavigationTarget() &&
        resolveStickToBottom({
          hasRecentUserScrollIntent,
          isAtBottom: isViewportAtBottom(viewport),
          isNearBottom: nextIsNearBottom,
          wasSticking: shouldStickToBottomRef.current,
        });

      if (pendingUserMessageIdRef.current) {
        if (!hasRecentUserScrollIntent) {
          return;
        }
        pendingUserMessageIdRef.current = null;
        setPendingUserMessageId(null);
      }

      const fallbackMessage = stickyUserMessages[0] ?? null;
      const lastMessage = stickyUserMessages.at(-1) ?? null;
      const virtualSelection = timelineScrollRef?.current?.getStickySelection();
      if (virtualSelection) {
        setStickyUserMessageState(virtualSelection.id);
        return;
      }
      const viewportRect = viewport.getBoundingClientRect();

      const candidates: StickyUserMessageCandidate[] = [];
      for (const message of stickyUserMessages) {
        const element = userMessageRefs.current[message.id];
        if (!element) {
          continue;
        }

        const elementRect = element.getBoundingClientRect();
        candidates.push({
          id: message.id,
          relativeTop: elementRect.top - viewportRect.top,
        });
      }

      const selection = resolveStickyUserMessage(
        candidates,
        fallbackMessage?.id ?? null,
        { atEnd: nextIsNearBottom, lastId: lastMessage?.id ?? null },
      );
      setStickyUserMessageState(selection.id);
    },
    [
      endAutoScroll,
      setNearBottomState,
      setStickyUserMessageState,
      timelineScrollRef,
      userMessageRefs,
      viewportRef,
    ],
  );

  const markUserScrollIntent = useCallback(() => {
    timelineScrollRef?.current?.cancelNavigation();
    userScrollIntentTsRef.current = performance.now();
    inputDirectionRef.current = null;
    setHasUserScrolled(true);
    endAutoScroll();
    const viewport = viewportRef.current;
    if (viewport && !isViewportNearBottom(viewport)) {
      shouldStickToBottomRef.current = false;
      setNearBottomState(false);
    }
  }, [endAutoScroll, setNearBottomState, timelineScrollRef, viewportRef]);

  const markUserScrollStart = useCallback(
    (deltaY?: number) => {
      timelineScrollRef?.current?.cancelNavigation();
      userScrollIntentTsRef.current = performance.now();
      inputDirectionRef.current = scrollDirectionOfDelta(deltaY);
      setHasUserScrolled(true);
      endAutoScroll();
      const viewport = viewportRef.current;
      if (
        shouldReleaseStickOnUserScroll({
          deltaY,
          isAtBottom: viewport ? isViewportAtBottom(viewport) : false,
        })
      ) {
        shouldStickToBottomRef.current = false;
      }
    },
    [endAutoScroll, timelineScrollRef, viewportRef],
  );

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      timelineScrollRef?.current?.cancelNavigation();
      clearPendingUserMessage();
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const nextTop = viewport.scrollHeight;

      if (behavior === "smooth") {
        autoScrollTargetRef.current = "bottom";
        setIsAutoScrolling(true);
      }

      if (typeof viewport.scrollTo === "function") {
        viewport.scrollTo({ behavior, top: nextTop });
      } else {
        viewport.scrollTop = nextTop;
      }

      shouldStickToBottomRef.current = true;
      setNearBottomState(true);
    },
    [
      clearPendingUserMessage,
      setNearBottomState,
      timelineScrollRef,
      viewportRef,
    ],
  );

  const scrollToTop = useCallback(() => {
    timelineScrollRef?.current?.cancelNavigation();
    clearPendingUserMessage();
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    // Jumping to the top is an explicit read-history action — break the
    // bottom lock so streaming updates do not yank the viewport back down.
    shouldStickToBottomRef.current = false;
    endAutoScroll();
    viewport.scrollTop = 0;
    timelineScrollRef?.current?.syncScrollOffset();
    setNearBottomState(false);
    setIsNearTop(true);
  }, [
    clearPendingUserMessage,
    endAutoScroll,
    setNearBottomState,
    timelineScrollRef,
    viewportRef,
  ]);

  const scrollToUserMessage = useCallback(
    (messageId: string) => {
      const viewport = viewportRef.current;
      const element = userMessageRefs.current[messageId];

      if (!viewport) {
        return;
      }

      shouldStickToBottomRef.current = false;
      userScrollIntentTsRef.current = 0;
      pendingUserMessageIdRef.current = messageId;
      setPendingUserMessageId(messageId);
      setStickyUserMessageState(messageId);

      if (timelineScrollRef?.current?.scrollToUserMessage(messageId)) {
        return;
      }

      if (!element) {
        return;
      }

      const mountedTop = getMountedUserMessageTop(element, viewport);
      if (mountedTop !== null) {
        viewport.scrollTop = Math.max(0, mountedTop - 20);
      }
    },
    [
      setStickyUserMessageState,
      timelineScrollRef,
      userMessageRefs,
      viewportRef,
    ],
  );

  const holdForDisclosure = useCallback(() => {
    shouldStickToBottomRef.current = false;
    timelineScrollRef?.current?.holdScrollPosition(DISCLOSURE_HOLD_MS);
  }, [timelineScrollRef]);

  const stickToBottomIfLocked = useCallback(() => {
    const viewport = viewportRef.current;
    if (
      !shouldFollowStreamOnResize({
        isAtBottom: viewport ? isViewportAtBottom(viewport) : false,
        isLocked: shouldStickToBottomRef.current,
        suppressFollow: false,
      })
    ) {
      if (viewport) {
        setNearBottomState(isViewportNearBottom(viewport));
        setIsNearTop(isViewportNearTop(viewport));
      }
      return;
    }

    scrollToLatest("auto");
  }, [scrollToLatest, setNearBottomState, viewportRef]);

  return {
    activeUserMessageId: pendingUserMessageId ?? stickyUserMessageId,
    hasUserScrolled,
    isAutoScrolling,
    isNearBottom,
    isNearTop,
    scrollDirection,
    markUserScrollIntent,
    markUserScrollStart,
    holdForDisclosure,
    stickToBottomIfLocked,
    scrollToLatest,
    scrollToTop,
    scrollToUserMessage,
    syncScrollState,
  };
}
