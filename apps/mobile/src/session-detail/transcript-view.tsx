import type { ImageAttachment } from "@cocurdex/shared";
import { SymbolView } from "expo-symbols";
import type { TFunction } from "i18next";
import {
  memo,
  type Ref,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Image,
  type ImageURISource,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MarkdownText } from "@/markdown";
import { scaledSize, useTextScale } from "@/preferences";
import { layout, space, type ThemeColors, useThemeColors } from "@/theme";
import { useScrollIndicatorWhileScrolling } from "@/ui";
import { JumpButton } from "./jump-button";
import type { TranscriptItem } from "./transcript";
import type { ActivityChild, CondensedItem } from "./transcript-activity";
import {
  hasUnseenLatest,
  INITIAL_JUMP_STATE,
  latestJumpLead,
  nextJumpState,
  oldestJumpLead,
  type ScrollMetrics,
} from "./transcript-jump";
import { TurnActions } from "./turn-actions";
import { useActivityLabel } from "./use-activity-label";

const BODY_SIZE = 16;
const BODY_LINE_HEIGHT = 24;

type ToolStatus = Extract<TranscriptItem, { kind: "tool" }>["status"];
type ActivityItem = Extract<CondensedItem, { kind: "activity" }>;
export type ImageSource = (attachment: ImageAttachment) => ImageURISource;

export interface TranscriptHandle {
  jumpToItem(id: string): void;
}

export interface TranscriptActions {
  hostId: string;
  fileRoot: string | null | undefined;
  imageSource: ImageSource;
  onOpenImage(attachment: ImageAttachment): void;
  onOpenTool(toolCallId: string): void;
  onFork: ((messageId: string) => void) | null;
}

const IMAGE_ASPECT = { min: 0.5, max: 2 } as const;

function imageAspect(attachment: ImageAttachment) {
  if (attachment.width <= 0 || attachment.height <= 0) return 1;
  const ratio = attachment.width / attachment.height;
  return Math.min(IMAGE_ASPECT.max, Math.max(IMAGE_ASPECT.min, ratio));
}

function UserImages({
  images,
  actions,
  colors,
}: {
  images: readonly ImageAttachment[];
  actions: TranscriptActions;
  colors: ThemeColors;
}) {
  return images.map((image) => (
    <Pressable
      key={image.id}
      accessibilityRole="imagebutton"
      accessibilityLabel={image.name}
      onPress={() => actions.onOpenImage(image)}
      style={[styles.image, { aspectRatio: imageAspect(image) }]}
    >
      <Image
        source={actions.imageSource(image)}
        style={[styles.imageFill, { backgroundColor: colors.muted }]}
      />
    </Pressable>
  ));
}

function ToolStatusIcon({
  status,
  colors,
}: {
  status: ToolStatus;
  colors: ThemeColors;
}) {
  if (status === "pending" || status === "in_progress") {
    return (
      <View style={styles.iconSlot}>
        <View style={[styles.ring, { borderColor: colors.brandMark }]} />
      </View>
    );
  }
  const failed = status === "failed";
  return (
    <SymbolView
      name={
        failed
          ? { ios: "xmark", android: "close" }
          : { ios: "checkmark", android: "check" }
      }
      size={14}
      tintColor={failed ? colors.destructive : colors.mutedForeground}
      style={styles.iconSlot}
    />
  );
}

function toolStatusLabel(status: ToolStatus, t: TFunction<"sessions">) {
  if (status === "completed") return t("tool.completed");
  if (status === "failed") return t("tool.failed");
  return t("tool.running");
}

function ToolRow({
  item,
  colors,
  onOpen,
}: {
  item: Extract<TranscriptItem, { kind: "tool" }>;
  colors: ThemeColors;
  onOpen(): void;
}) {
  const { t } = useTranslation("sessions");
  const label = item.detail ? `${item.title} ${item.detail}` : item.title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: toolStatusLabel(item.status, t) }}
      onPress={onOpen}
      style={styles.tool}
      testID={`transcript-tool-${item.id}`}
    >
      <ToolStatusIcon status={item.status} colors={colors} />
      <Text
        numberOfLines={1}
        style={[styles.toolText, { color: colors.mutedForeground }]}
      >
        {item.title}
        {item.detail ? (
          <Text
            style={[styles.toolDetail, { color: colors.foreground }]}
          >{` ${item.detail}`}</Text>
        ) : null}
      </Text>
      <SymbolView
        name={{ ios: "chevron.right", android: "chevron_right" }}
        size={12}
        tintColor={colors.mutedForeground}
      />
    </Pressable>
  );
}

function ActivityRow({
  item,
  colors,
  actions,
  expanded,
  onToggle,
}: {
  item: ActivityItem;
  colors: ThemeColors;
  actions: TranscriptActions;
  expanded: boolean;
  onToggle(): void;
}) {
  const label = useActivityLabel(item);
  return (
    <View style={styles.activity}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.tool}
        testID={`transcript-activity-${item.id}`}
      >
        <Text
          numberOfLines={1}
          style={[styles.activityText, { color: colors.mutedForeground }]}
        >
          {label}
        </Text>
        <SymbolView
          name={
            expanded
              ? { ios: "chevron.down", android: "keyboard_arrow_down" }
              : { ios: "chevron.right", android: "chevron_right" }
          }
          size={12}
          tintColor={colors.mutedForeground}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.activityItems}>
          {item.items.map((child) => (
            <ActivityChildRow
              key={`${child.kind}:${child.id}`}
              item={child}
              colors={colors}
              actions={actions}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ActivityChildRow({
  item,
  colors,
  actions,
}: {
  item: ActivityChild;
  colors: ThemeColors;
  actions: TranscriptActions;
}) {
  if (item.kind === "assistant") {
    return (
      <MarkdownText
        markdown={item.text}
        streaming={item.streaming}
        hostId={actions.hostId}
        fileRoot={actions.fileRoot}
        testID={`transcript-assistant-${item.id}`}
      />
    );
  }
  return (
    <ToolRow
      item={item}
      colors={colors}
      onOpen={() => actions.onOpenTool(item.id)}
    />
  );
}

function UserText({ text, color }: { text: string; color: string }) {
  const scale = useTextScale();
  return (
    <Text
      selectable
      style={[
        styles.body,
        {
          color,
          fontSize: scaledSize(BODY_SIZE, scale),
          lineHeight: scaledSize(BODY_LINE_HEIGHT, scale),
        },
      ]}
    >
      {text}
    </Text>
  );
}

const TranscriptRow = memo(function TranscriptRow({
  item,
  colors,
  actions,
  expanded,
  onToggle,
}: {
  item: CondensedItem;
  colors: ThemeColors;
  actions: TranscriptActions;
  expanded: boolean;
  onToggle(id: string): void;
}) {
  if (item.kind === "user") {
    return (
      <View style={styles.userTurn} testID={`transcript-user-${item.id}`}>
        <UserImages images={item.images} actions={actions} colors={colors} />
        {item.text ? (
          <View style={[styles.bubble, { backgroundColor: colors.muted }]}>
            <UserText text={item.text} color={colors.foreground} />
          </View>
        ) : null}
      </View>
    );
  }
  if (item.kind === "assistant") {
    return (
      <View>
        <MarkdownText
          markdown={item.text}
          streaming={item.streaming}
          hostId={actions.hostId}
          fileRoot={actions.fileRoot}
          testID={`transcript-assistant-${item.id}`}
        />
        {item.turnEnd ? (
          <TurnActions
            text={item.text}
            onFork={actions.onFork ? () => actions.onFork?.(item.id) : null}
          />
        ) : null}
      </View>
    );
  }
  if (item.kind === "activity") {
    return (
      <ActivityRow
        item={item}
        colors={colors}
        actions={actions}
        expanded={expanded}
        onToggle={() => onToggle(item.id)}
      />
    );
  }
  return (
    <ToolRow
      item={item}
      colors={colors}
      onOpen={() => actions.onOpenTool(item.id)}
    />
  );
});

function useStableActions(actions: TranscriptActions): TranscriptActions {
  const latest = useRef(actions);
  latest.current = actions;
  const { hostId, fileRoot } = actions;
  const canFork = actions.onFork !== null;
  return useMemo(
    () => ({
      hostId,
      fileRoot,
      imageSource: (attachment) => latest.current.imageSource(attachment),
      onOpenImage: (attachment) => latest.current.onOpenImage(attachment),
      onOpenTool: (toolCallId) => latest.current.onOpenTool(toolCallId),
      onFork: canFork
        ? (messageId) => latest.current.onFork?.(messageId)
        : null,
    }),
    [hostId, fileRoot, canFork],
  );
}

interface VisibleAnchor {
  items: readonly CondensedItem[];
  minIndexForVisible: number;
}

function toggledSet(current: ReadonlySet<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

const MAX_INDEX_RETRIES = 3;
const OLDEST_SETTLE_MS = 300;

function scrollMetrics(event: NativeSyntheticEvent<NativeScrollEvent>) {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  return {
    offset: contentOffset.y,
    contentHeight: contentSize.height,
    viewportHeight: layoutMeasurement.height,
  };
}

export function TranscriptView({
  items,
  footer,
  actions,
  ref,
}: {
  items: readonly CondensedItem[];
  footer?: React.ReactElement;
  actions: TranscriptActions;
  ref?: Ref<TranscriptHandle>;
}) {
  const scrollIndicator = useScrollIndicatorWhileScrolling();
  const colors = useThemeColors();
  const listRef = useRef<FlatList<CondensedItem>>(null);
  const lastMetrics = useRef<ScrollMetrics | null>(null);
  const lastOffset = useRef(0);
  const rowActions = useStableActions(actions);
  const seekingOldest = useRef(false);
  const pendingOldest = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRetries = useRef(0);
  const [jump, setJump] = useState(INITIAL_JUMP_STATE);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<VisibleAnchor | null>(null);
  const newestFirst = useMemo(() => [...items].reverse(), [items]);
  const shown = useRef({ items, newestFirst });
  shown.current = { items, newestFirst };
  const toggle = useCallback((id: string) => {
    const { items: current, newestFirst: ordered } = shown.current;
    const index = ordered.findIndex((item) => item.id === id);
    setAnchor({ items: current, minIndexForVisible: index + 1 });
    requestAnimationFrame(() =>
      setExpanded((expandedIds) => toggledSet(expandedIds, id)),
    );
  }, []);
  const renderItem = useCallback(
    ({ item }: { item: CondensedItem }) => (
      <TranscriptRow
        item={item}
        colors={colors}
        actions={rowActions}
        expanded={expanded.has(item.id)}
        onToggle={toggle}
      />
    ),
    [colors, rowActions, expanded, toggle],
  );
  const scrollToIndex = (index: number) =>
    listRef.current?.scrollToIndex({ index, viewPosition: 1, animated: true });
  useImperativeHandle(ref, () => ({
    jumpToItem: (id) => {
      const index = newestFirst.findIndex((item) => item.id === id);
      if (index < 0) return;
      seekingOldest.current = false;
      indexRetries.current = 0;
      scrollToIndex(index);
    },
  }));
  const jumpToLatest = () => {
    seekingOldest.current = false;
    const list = listRef.current;
    const metrics = lastMetrics.current;
    const lead = metrics ? latestJumpLead(metrics) : null;
    if (lead !== null) list?.scrollToOffset({ offset: lead, animated: false });
    requestAnimationFrame(() =>
      list?.scrollToOffset({ offset: 0, animated: true }),
    );
  };
  const jumpToOldest = () => {
    seekingOldest.current = true;
    const list = listRef.current;
    const metrics = lastMetrics.current;
    const lead = metrics ? oldestJumpLead(metrics) : null;
    if (lead === null) {
      list?.scrollToEnd({ animated: true });
      return;
    }
    list?.scrollToOffset({ offset: lead, animated: false });
    pendingOldest.current = setTimeout(finishOldestJump, OLDEST_SETTLE_MS);
  };
  const finishOldestJump = () => {
    if (pendingOldest.current === null) return;
    clearTimeout(pendingOldest.current);
    pendingOldest.current = null;
    listRef.current?.scrollToEnd({ animated: true });
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const metrics = scrollMetrics(event);
    lastMetrics.current = metrics;
    const previous = lastOffset.current;
    lastOffset.current = metrics.offset;
    const remaining =
      metrics.contentHeight - metrics.viewportHeight - metrics.offset;
    if (remaining <= 1) seekingOldest.current = false;
    setJump((current) =>
      nextJumpState(current, metrics, previous, items.length),
    );
  };
  const onScrollBeginDrag = () => {
    seekingOldest.current = false;
    scrollIndicator.onScrollBeginDrag();
    setJump((current) =>
      current.userScrolled ? current : { ...current, userScrolled: true },
    );
  };
  return (
    <View style={styles.fill}>
      <FlatList
        {...scrollIndicator}
        ref={listRef}
        inverted
        scrollsChildToFocus={false}
        maintainVisibleContentPosition={
          anchor?.items === items
            ? { minIndexForVisible: anchor.minIndexForVisible }
            : undefined
        }
        data={newestFirst}
        extraData={expanded}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
        ListHeaderComponent={footer}
        scrollEventThrottle={32}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onContentSizeChange={() => {
          if (pendingOldest.current !== null) {
            requestAnimationFrame(finishOldestJump);
          } else if (seekingOldest.current) {
            listRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          if (indexRetries.current >= MAX_INDEX_RETRIES) return;
          indexRetries.current += 1;
          listRef.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: false,
          });
          requestAnimationFrame(() => scrollToIndex(index));
        }}
        renderItem={renderItem}
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
  userTurn: { alignItems: "flex-end", gap: space.xs },
  image: { width: "60%", borderRadius: 16, overflow: "hidden" },
  imageFill: { width: "100%", height: "100%" },
  bubble: {
    maxWidth: `${layout.bubbleMaxWidthRatio * 100}%`,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  body: { fontSize: BODY_SIZE, lineHeight: BODY_LINE_HEIGHT },
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 32,
  },
  toolText: { flex: 1, fontSize: 14 },
  activity: { gap: space.xs },
  activityText: { flex: 1, fontSize: 14 },
  activityItems: { gap: space.sm, paddingLeft: space.md },
  toolDetail: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  iconSlot: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.75 },
});
