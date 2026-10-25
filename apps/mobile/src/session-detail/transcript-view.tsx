import type { ImageAttachment } from "@cocurdex/shared";
import { SymbolView } from "expo-symbols";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Image,
  type ImageURISource,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MarkdownText } from "@/markdown";
import { layout, space, type ThemeColors, useThemeColors } from "@/theme";
import type { TranscriptItem } from "./transcript";
import type { ActivityChild, CondensedItem } from "./transcript-activity";
import { TurnActions } from "./turn-actions";
import { useActivityLabel } from "./use-activity-label";

type ToolStatus = Extract<TranscriptItem, { kind: "tool" }>["status"];
type ActivityItem = Extract<CondensedItem, { kind: "activity" }>;
export type ImageSource = (attachment: ImageAttachment) => ImageURISource;

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

function TranscriptRow({
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
  onToggle(): void;
}) {
  if (item.kind === "user") {
    return (
      <View style={styles.userTurn} testID={`transcript-user-${item.id}`}>
        <UserImages images={item.images} actions={actions} colors={colors} />
        {item.text ? (
          <View style={[styles.bubble, { backgroundColor: colors.muted }]}>
            <Text
              selectable
              style={[styles.body, { color: colors.foreground }]}
            >
              {item.text}
            </Text>
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
        onToggle={onToggle}
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

export function TranscriptView({
  items,
  footer,
  actions,
}: {
  items: readonly CondensedItem[];
  footer?: React.ReactElement;
  actions: TranscriptActions;
}) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const newestFirst = useMemo(() => [...items].reverse(), [items]);
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <FlatList
      inverted
      data={newestFirst}
      extraData={expanded}
      keyExtractor={(item) => `${item.kind}:${item.id}`}
      keyboardDismissMode="interactive"
      contentContainerStyle={styles.content}
      ListHeaderComponent={footer}
      renderItem={({ item }) => (
        <TranscriptRow
          item={item}
          colors={colors}
          actions={actions}
          expanded={expanded.has(item.id)}
          onToggle={() => toggle(item.id)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
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
  body: { fontSize: 16, lineHeight: 24 },
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
