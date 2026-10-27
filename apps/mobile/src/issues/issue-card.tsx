import type { IssueRecord } from "@cocurdex/shared";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { space, useThemeColors } from "@/theme";
import { IssuePriorityMark } from "./issue-priority-mark";
import { IssueStatusMark } from "./issue-status-mark";

const CARD_RADIUS = 16;

export function IssueCard({
  issue,
  statusTitle,
  priorityTitle,
  onPress,
  onMove,
}: {
  issue: IssueRecord;
  statusTitle: string;
  priorityTitle: string | null;
  onPress(): void;
  onMove(): void;
}) {
  const { t } = useTranslation("issues");
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={issue.title}
      accessibilityValue={{ text: `${statusTitle}, ${issue.identifier}` }}
      accessibilityActions={[{ name: "move", label: t("board.move") }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "move") onMove();
      }}
      onPress={onPress}
      onLongPress={onMove}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.muted : colors.card,
          borderColor: colors.border,
        },
      ]}
      testID={`issue-card-${issue.id}`}
    >
      <Text style={[styles.identifier, { color: colors.mutedForeground }]}>
        {issue.identifier}
      </Text>
      <View style={styles.titleRow}>
        <View style={styles.mark}>
          <IssueStatusMark
            category={issue.statusCategory}
            label={statusTitle}
          />
        </View>
        <Text
          numberOfLines={3}
          style={[styles.title, { color: colors.foreground }]}
        >
          {issue.title}
        </Text>
      </View>
      {priorityTitle ? (
        <IssuePriorityMark priority={issue.priority} label={priorityTitle} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    gap: 6,
  },
  identifier: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 12,
    lineHeight: 16,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  mark: { height: 22, justifyContent: "center" },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "600" },
});
