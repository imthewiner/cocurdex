import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { layout, space, type ThemeColors, useThemeColors } from "@/theme";
import type { TranscriptItem } from "./transcript";

type ToolStatus = Extract<TranscriptItem, { kind: "tool" }>["status"];

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

function TranscriptRow({
  item,
  colors,
}: {
  item: TranscriptItem;
  colors: ThemeColors;
}) {
  if (item.kind === "user") {
    return (
      <View
        style={[styles.bubble, { backgroundColor: colors.muted }]}
        testID={`transcript-user-${item.id}`}
      >
        <Text selectable style={[styles.body, { color: colors.foreground }]}>
          {item.text}
        </Text>
      </View>
    );
  }
  if (item.kind === "assistant") {
    return (
      <Text
        selectable
        style={[styles.body, { color: colors.foreground }]}
        testID={`transcript-assistant-${item.id}`}
      >
        {item.text}
      </Text>
    );
  }
  return (
    <View style={styles.tool}>
      <ToolStatusIcon status={item.status} colors={colors} />
      <Text
        numberOfLines={1}
        style={[styles.toolTitle, { color: colors.mutedForeground }]}
      >
        {item.title}
      </Text>
    </View>
  );
}

export function TranscriptView({
  items,
  footer,
}: {
  items: readonly TranscriptItem[];
  footer?: React.ReactElement;
}) {
  const colors = useThemeColors();
  const newestFirst = useMemo(() => [...items].reverse(), [items]);
  return (
    <FlatList
      inverted
      data={newestFirst}
      keyExtractor={(item) => `${item.kind}:${item.id}`}
      keyboardDismissMode="interactive"
      contentContainerStyle={styles.content}
      ListHeaderComponent={footer}
      renderItem={({ item }) => <TranscriptRow item={item} colors={colors} />}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideMargin,
    paddingVertical: space.md,
    gap: space.md,
  },
  bubble: {
    alignSelf: "flex-end",
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
    minHeight: 28,
  },
  toolTitle: { flex: 1, fontSize: 14 },
  iconSlot: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.75 },
});
