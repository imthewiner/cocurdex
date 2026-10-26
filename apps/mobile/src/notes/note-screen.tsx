import type { SavedHost } from "@cocurdex/client-runtime";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinkedEntitiesList } from "@/entity-links";
import { MarkdownText } from "@/markdown";
import { useHostSessions } from "@/sessions";
import { layout, space, useThemeColors } from "@/theme";
import { ListNotice, useAgeLabel } from "@/ui";
import { useNote, useNotes } from "./note-queries";

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
  const summary = useNotes(host.hostId, { cached: true }).data?.find(
    (entry) => entry.id === noteId,
  );
  const shown = note.data ?? summary;
  const { workspaces } = useHostSessions(host.hostId);
  const age = useAgeLabel(shown?.updatedAt ?? new Date().toISOString());

  if (note.data === null) return <ListNotice title={t("missing")} />;
  if (!shown) {
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

  const workspace = workspaces.find((entry) => entry.id === shown.workspaceId);
  const meta = [workspace?.name, age].filter(Boolean).join(" · ");
  const body = note.data?.bodyMarkdown.trim();

  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView
        scrollsChildToFocus={false}
        style={styles.fill}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.body}>
          <Text
            accessibilityRole="header"
            selectable
            style={[styles.title, { color: colors.foreground }]}
          >
            {shown.icon ? `${shown.icon} ` : ""}
            {shown.title}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {meta}
          </Text>
          {body ? (
            <MarkdownText
              markdown={body}
              hostId={host.hostId}
              testID="note-body"
            />
          ) : body === "" ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {t("emptyBody")}
            </Text>
          ) : null}
        </View>
        <LinkedEntitiesList
          hostId={host.hostId}
          entity={{ kind: "note", id: shown.id }}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: space.xxl },
  body: { paddingHorizontal: layout.sideMargin, gap: space.sm },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "600" },
  meta: { fontSize: 13, marginBottom: space.sm },
});
