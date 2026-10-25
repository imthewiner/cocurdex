import { Pressable, StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import { useAgeLabel } from "@/ui";
import type { NoteRow } from "./note-sections";

const INDENT = 16;

export function NoteRowView({
  row,
  onPress,
}: {
  row: NoteRow;
  onPress(): void;
}) {
  const colors = useThemeColors();
  const age = useAgeLabel(row.note.updatedAt);
  const folder = row.note.kind === "folder";
  return (
    <Pressable
      accessibilityLabel={row.note.title}
      accessibilityRole="button"
      accessibilityValue={{ text: age }}
      disabled={folder}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { paddingLeft: layout.sideMargin + row.depth * INDENT },
        pressed && { backgroundColor: colors.muted },
      ]}
      testID={`note-row-${row.note.id}`}
    >
      <View style={styles.line}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            { color: folder ? colors.mutedForeground : colors.foreground },
          ]}
        >
          {row.note.icon ? `${row.note.icon} ` : ""}
          {row.note.title}
        </Text>
        {folder ? null : (
          <Text style={[styles.age, { color: colors.mutedForeground }]}>
            {age}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: space.sm,
    paddingRight: layout.sideMargin,
  },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "500" },
  age: { fontSize: 13, fontVariant: ["tabular-nums"] },
});
