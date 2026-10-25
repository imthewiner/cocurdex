import type { SavedHost } from "@cocurdex/client-runtime";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MarkdownText } from "@/markdown";
import { useHostSessions } from "@/sessions";
import { layout, space, useThemeColors } from "@/theme";
import { ListNotice, useAgeLabel } from "@/ui";
import { useNote } from "./note-queries";

export function NoteScreen({
  host,
  noteId,
}: {
  host: SavedHost;
  noteId: string;
}) {
  const { t } = useTranslation("notes");
  const colors = useThemeColors();
  const note = useNote(host.hostId, noteId);
  const { workspaces } = useHostSessions(host.hostId);
  const age = useAgeLabel(note.data?.updatedAt ?? new Date().toISOString());

  if (note.data === undefined) {
    if (!note.error) return <View style={styles.fill} />;
    return (
      <ListNotice
        title={t("unavailable.title", { host: host.name })}
        action={{
          label: t("unavailable.retry"),
          onPress: () => void note.mutate(),
        }}
      />
    );
  }
  if (note.data === null) return <ListNotice title={t("missing")} />;

  const workspace = workspaces.find(
    (entry) => entry.id === note.data?.workspaceId,
  );
  const meta = [workspace?.name, age].filter(Boolean).join(" · ");
  const body = note.data.bodyMarkdown.trim();

  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView
        style={styles.fill}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Text
          accessibilityRole="header"
          selectable
          style={[styles.title, { color: colors.foreground }]}
        >
          {note.data.icon ? `${note.data.icon} ` : ""}
          {note.data.title}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {meta}
        </Text>
        {body ? (
          <MarkdownText markdown={body} testID="note-body" />
        ) : (
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {t("emptyBody")}
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    paddingHorizontal: layout.sideMargin,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  meta: { fontSize: 13, marginBottom: space.sm },
});
