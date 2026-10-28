import {
  type ReactElement,
  type Ref,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import { layout, space } from "@/theme";
import { useScrollIndicatorWhileScrolling } from "@/ui";
import { JumpButton } from "./jump-button";
import type { CondensedItem } from "./transcript-activity";
import {
  hasUnseenLatest,
  INITIAL_JUMP_STATE,
  isFarFromLatest,
  isFarFromOldest,
  nextJumpState,
  type ScrollMetrics,
} from "./transcript-jump";
import { type TranscriptTurn, transcriptTurns } from "./transcript-turns";

export interface TranscriptHandle {
  jumpToItem(id: string): void;
}

export function TranscriptList({
  items,
  footer,
  renderRow,
  sentMessageId,
  ref,
}: {
  items: readonly CondensedItem[];
  footer?: ReactElement;
  renderRow: (item: CondensedItem) => ReactElement;
  sentMessageId?: string;
  ref?: Ref<TranscriptHandle>;
}) {
  const indicator = useScrollIndicatorWhileScrolling();
  const list = useRef<FlatList<TranscriptTurn>>(null);
  const metrics = useRef<ScrollMetrics | null>(null);
  const indexFailed = useRef(false);
  const latestLayout = useRef<{ id: string; height: number } | null>(null);
  const navigation = useRef({
    sentMessageId,
    target: sentMessageId,
    follow: true,
    retries: 0,
  });
  if (navigation.current.sentMessageId !== sentMessageId) {
    navigation.current = {
      sentMessageId,
      target: sentMessageId,
      follow: true,
      retries: 0,
    };
  }
  const [viewportHeight, setViewportHeight] = useState(0);
  const [jump, setJump] = useState(INITIAL_JUMP_STATE);
  const turns = useMemo(() => transcriptTurns(items), [items]);
  const history = useMemo(() => turns.slice(0, -1), [turns]);
  const latest = turns.at(-1);
  const align = () => {
    const state = navigation.current;
    if (state.target) {
      const index = turns.findIndex((turn) =>
        turn.items.some((item) => item.id === state.target),
      );
      if (index === turns.length - 1 && metrics.current) {
        if (!latest || latestLayout.current?.id !== latest.id) return;
        list.current?.scrollToOffset({
          offset: Math.max(
            0,
            metrics.current.contentHeight -
              latestLayout.current.height -
              space.md,
          ),
          animated: false,
        });
        state.target = undefined;
      } else if (index >= 0) {
        indexFailed.current = false;
        list.current?.scrollToIndex({
          index,
          viewPosition: 0,
          viewOffset: space.md,
          animated: false,
        });
        if (!indexFailed.current) state.target = undefined;
      }
    } else if (state.follow && metrics.current) {
      list.current?.scrollToOffset({
        offset: Math.max(
          0,
          metrics.current.contentHeight - metrics.current.viewportHeight,
        ),
        animated: false,
      });
    }
  };
  useImperativeHandle(ref, () => ({
    jumpToItem(id) {
      navigation.current.target = id;
      navigation.current.follow = false;
      navigation.current.retries = 0;
      align();
    },
  }));
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = {
      offset: contentOffset.y,
      contentHeight: contentSize.height,
      viewportHeight: layoutMeasurement.height,
    };
    const previous = metrics.current?.offset ?? next.offset;
    metrics.current = next;
    setJump((current) => nextJumpState(current, next, previous, items.length));
  };
  const jumpToLatest = () => {
    navigation.current.target = undefined;
    navigation.current.follow = true;
    const current = metrics.current;
    if (current)
      list.current?.scrollToOffset({
        offset: Math.max(0, current.contentHeight - current.viewportHeight),
        animated: !isFarFromLatest(current),
      });
  };
  const jumpToOldest = () => {
    navigation.current.target = undefined;
    navigation.current.follow = false;
    list.current?.scrollToOffset({
      offset: 0,
      animated: metrics.current !== null && !isFarFromOldest(metrics.current),
    });
  };
  return (
    <View style={styles.fill}>
      <FlatList
        {...indicator}
        ref={list}
        data={history}
        keyExtractor={(turn) => turn.id}
        extraData={[viewportHeight, renderRow, footer]}
        scrollsChildToFocus={false}
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
        scrollEventThrottle={32}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          navigation.current.target = undefined;
          navigation.current.follow = false;
          indicator.onScrollBeginDrag();
          setJump((current) => ({ ...current, userScrolled: true }));
        }}
        onScrollEndDrag={(event) => {
          indicator.onScrollEndDrag();
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
          navigation.current.follow =
            contentSize.height - layoutMeasurement.height - contentOffset.y <=
            24;
        }}
        onMomentumScrollEnd={(event) => {
          indicator.onMomentumScrollEnd();
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
          navigation.current.follow =
            contentSize.height - layoutMeasurement.height - contentOffset.y <=
            24;
        }}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_width, height) => {
          const previous = metrics.current;
          const next = {
            offset: previous?.offset ?? 0,
            contentHeight: height,
            viewportHeight,
          };
          metrics.current = next;
          setJump((current) =>
            nextJumpState(current, next, next.offset, items.length),
          );
          align();
        }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          indexFailed.current = true;
          if (navigation.current.retries >= 12) return;
          navigation.current.retries += 1;
          list.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: false,
          });
          requestAnimationFrame(align);
        }}
        renderItem={({ item }) => (
          <View testID={`transcript-turn-${item.id}`} style={styles.turn}>
            {item.items.map(renderRow)}
          </View>
        )}
        ListFooterComponent={
          latest ? (
            <View
              key={latest.id}
              testID={`transcript-turn-${latest.id}`}
              style={[
                styles.turn,
                { minHeight: Math.max(0, viewportHeight - space.md * 2) },
              ]}
              onLayout={(event) => {
                latestLayout.current = {
                  id: latest.id,
                  height: event.nativeEvent.layout.height,
                };
                align();
              }}
            >
              {latest.items.map(renderRow)}
              {footer}
            </View>
          ) : (
            footer
          )
        }
      />
      {jump.kind ? (
        <JumpButton
          target={jump.kind}
          unseen={jump.kind === "latest" && hasUnseenLatest(jump, items.length)}
          onPress={jump.kind === "latest" ? jumpToLatest : jumpToOldest}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    paddingHorizontal: layout.sideMargin,
    paddingVertical: space.md,
    gap: space.md,
  },
  turn: { gap: space.md },
});
