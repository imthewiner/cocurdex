import {
  resolveScrollDirection,
  type ScrollDirection,
  scrollDirectionOfDelta,
} from "@cocurdex/shared";
import { type RefObject, useCallback, useRef, useState } from "react";
import {
  getTranscriptContentHeight,
  isViewportAtBottom,
  isViewportNearTop,
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
  const initialPositionPendingRef = useRef(true);
  const userScrollIntentTsRef = useRef(0);
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

      const nextIsNearBottom = isViewportAtBottom(viewport);
      const nextIsNearTop = isViewportNearTop(viewport);
      setIsNearTop(nextIsNearTop);

      const hasRecentUserScrollIntent =
        performance.now() - userScrollIntentTsRef.current <
        USER_SCROLL_INTENT_WINDOW_MS;
      const scrollTop = viewport.scrollTop;
      const scrollDelta = scrollTop - lastScrollTopRef.current;
      if (Math.abs(scrollDelta) >= 12 || !hasRecentUserScrollIntent) {
        lastScrollTopRef.current = scrollTop;
      }
      setScrollDirection((current) =>
        Math.abs(scrollDelta) < 12
          ? current
          : resolveScrollDirection({
              current,
              scrollDelta,
              inputDirection: inputDirectionRef.current,
              hasRecentUserScrollIntent,
            }),
      );

      setNearBottomState(nextIsNearBottom);

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
    const viewport = viewportRef.current;
    if (viewport && !isViewportAtBottom(viewport)) {
      initialPositionPendingRef.current = false;
      setNearBottomState(false);
    }
  }, [setNearBottomState, timelineScrollRef, viewportRef]);

  const markUserScrollStart = useCallback(
    (deltaY?: number) => {
      timelineScrollRef?.current?.cancelNavigation();
      userScrollIntentTsRef.current = performance.now();
      inputDirectionRef.current = scrollDirectionOfDelta(deltaY);
      setHasUserScrolled(true);
      initialPositionPendingRef.current = false;
    },
    [timelineScrollRef],
  );

  const scrollToLatest = useCallback(
    (smooth = false) => {
      timelineScrollRef?.current?.cancelNavigation();
      clearPendingUserMessage();
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const top = Math.max(
        0,
        getTranscriptContentHeight(viewport) - viewport.clientHeight,
      );
      if (
        smooth &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        viewport.scrollTo({ top, behavior: "smooth" });
      } else {
        viewport.scrollTop = top;
      }
      timelineScrollRef?.current?.syncScrollOffset();
      initialPositionPendingRef.current = false;
      setNearBottomState(isViewportAtBottom(viewport));
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

    initialPositionPendingRef.current = false;
    viewport.scrollTop = 0;
    timelineScrollRef?.current?.syncScrollOffset();
    setNearBottomState(false);
    setIsNearTop(true);
  }, [
    clearPendingUserMessage,
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

      initialPositionPendingRef.current = false;
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
    initialPositionPendingRef.current = false;
    timelineScrollRef?.current?.holdScrollPosition(DISCLOSURE_HOLD_MS);
  }, [timelineScrollRef]);

  const finishInitialPositioning = useCallback(() => {
    initialPositionPendingRef.current = false;
  }, []);

  const syncViewportLayout = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (initialPositionPendingRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      timelineScrollRef?.current?.syncScrollOffset();
    }
    setNearBottomState(isViewportAtBottom(viewport));
    setIsNearTop(isViewportNearTop(viewport));
  }, [setNearBottomState, timelineScrollRef, viewportRef]);

  return {
    finishInitialPositioning,
    activeUserMessageId: pendingUserMessageId ?? stickyUserMessageId,
    hasUserScrolled,
    isNearBottom,
    isNearTop,
    scrollDirection,
    markUserScrollIntent,
    markUserScrollStart,
    holdForDisclosure,
    syncViewportLayout,
    scrollToLatest,
    scrollToTop,
    scrollToUserMessage,
    syncScrollState,
  };
}
