import type { ImageAttachment } from "@cocurdex/shared";
import { SymbolView } from "expo-symbols";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Image,
  type ImageURISource,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { layout, space, type ThemeColors, useThemeColors } from "@/theme";
import { MessageMarkdown } from "./message-markdown";
import type { TranscriptItem } from "./transcript";

type ToolStatus = Extract<TranscriptItem, { kind: "tool" }>["status"];
export type ImageSource = (attachment: ImageAttachment) => ImageURISource;

const IMAGE_ASPECT = { min: 0.5, max: 2 } as const;

function imageAspect(attachment: ImageAttachment) {
  if (attachment.width <= 0 || attachment.height <= 0) return 1;
  const ratio = attachment.width / attachment.height;
  return Math.min(IMAGE_ASPECT.max, Math.max(IMAGE_ASPECT.min, ratio));
}

function UserImages({
  images,
  imageSource,
  colors,
}: {
  images: readonly ImageAttachment[];
  imageSource: ImageSource;
  colors: ThemeColors;
}) {
  return images.map((image) => (
    <Image
      key={image.id}
      accessibilityLabel={image.name}
      source={imageSource(image)}
      style={[
        styles.image,
        { aspectRatio: imageAspect(image), backgroundColor: colors.muted },
      ]}
    />
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
}: {
  item: Extract<TranscriptItem, { kind: "tool" }>;
  colors: ThemeColors;
}) {
  const { t } = useTranslation("sessions");
  const label = item.detail ? `${item.title} ${item.detail}` : item.title;
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityValue={{ text: toolStatusLabel(item.status, t) }}
      style={styles.tool}
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
    </View>
  );
}

function TranscriptRow({
  item,
  colors,
  imageSource,
}: {
  item: TranscriptItem;
  colors: ThemeColors;
  imageSource: ImageSource;
}) {
  if (item.kind === "user") {
    return (
      <View style={styles.userTurn} testID={`transcript-user-${item.id}`}>
        <UserImages
          images={item.images}
          imageSource={imageSource}
          colors={colors}
        />
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
      <MessageMarkdown
        markdown={item.text}
        testID={`transcript-assistant-${item.id}`}
      />
    );
  }
  return <ToolRow item={item} colors={colors} />;
}

export function TranscriptView({
  items,
  footer,
  imageSource,
}: {
  items: readonly TranscriptItem[];
  footer?: React.ReactElement;
  imageSource: ImageSource;
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
      renderItem={({ item }) => (
        <TranscriptRow item={item} colors={colors} imageSource={imageSource} />
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
  image: { width: "60%", borderRadius: 16 },
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
    minHeight: 24,
  },
  toolText: { flex: 1, fontSize: 14 },
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
