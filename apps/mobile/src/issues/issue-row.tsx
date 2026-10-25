import type { IssueRecord } from "@cocurdex/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import { IssueStatusMark } from "./issue-status-mark";

export function IssueRowView({
  issue,
  statusTitle,
  labelNames,
  onPress,
}: {
  issue: IssueRecord;
  statusTitle: string;
  labelNames: string[];
  onPress(): void;
}) {
  const colors = useThemeColors();
  const detail = [issue.identifier, ...labelNames].join(" · ");
  return (
    <Pressable
      accessibilityLabel={issue.title}
      accessibilityRole="button"
      accessibilityValue={{ text: `${statusTitle}, ${detail}` }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.muted },
      ]}
      testID={`issue-row-${issue.id}`}
    >
      <View style={styles.mark}>
        <IssueStatusMark category={issue.statusCategory} label={statusTitle} />
      </View>
      <View style={styles.text}>
        <Text
          numberOfLines={2}
          style={[styles.title, { color: colors.foreground }]}
        >
          {issue.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.detail, { color: colors.mutedForeground }]}
        >
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: layout.sideMargin,
  },
  mark: { height: 22, justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  detail: { fontSize: 13, fontVariant: ["tabular-nums"] },
});
