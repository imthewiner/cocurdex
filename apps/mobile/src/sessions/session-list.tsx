import type { SavedHost } from "@cocurdex/client-runtime";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import { ListNotice, ListSectionHeader, ListSeparator } from "@/ui";
import { SessionActionsSheet } from "./session-actions-sheet";
import { SessionRowView } from "./session-row";
import { buildSessionSections, type SessionRow } from "./session-sections";
import { useHostSessions } from "./sessions";
import type { HostSessionsSnapshot } from "./sessions-store";

const OFFLINE_STATES = new Set<HostSessionsSnapshot["connection"]>([
  "retrying",
  "waiting",
]);

export function SessionList({
  host,
  query,
  onReload,
}: {
  host: SavedHost;
  query: string;
  onReload(): void;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const router = useRouter();
  const snapshot = useHostSessions(host.hostId);
  const [actionTarget, setActionTarget] = useState<{
    row: SessionRow;
    workspace: string;
  } | null>(null);
  const sections = useMemo(
    () =>
      buildSessionSections({
        workspaces: snapshot.workspaces,
        sessions: snapshot.sessions,
        attention: snapshot.attention,
        query,
      }).map((section) => ({ ...section, data: section.rows })),
    [snapshot.workspaces, snapshot.sessions, snapshot.attention, query],
  );

  if (!snapshot.loaded) {
    if (!snapshot.failed) return <View style={styles.fill} />;
    return (
      <ListNotice
        title={t("unavailable.title", { host: host.name })}
        description={t("unavailable.description")}
        action={{ label: t("unavailable.retry"), onPress: onReload }}
      />
    );
  }

  const offline = OFFLINE_STATES.has(snapshot.connection);
  const searching = query.trim() !== "";

  return (
    <>
      <SectionList<SessionRow>
        style={styles.fill}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        sections={sections}
        keyExtractor={(row) => row.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          offline ? (
            <Text style={[styles.offline, { color: colors.mutedForeground }]}>
              {t("offline", { host: host.name })}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          searching ? (
            <ListNotice title={t("noResults", { query: query.trim() })} />
          ) : (
            <ListNotice
              title={t("empty.title")}
              description={t("empty.description", { host: host.name })}
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <ListSectionHeader title={section.title} />
        )}
        renderItem={({ item, section }) => (
          <SessionRowView
            row={item}
            onLongPress={() =>
              setActionTarget({ row: item, workspace: section.title })
            }
            onPress={() =>
              router.push({
                pathname: "/session/[hostId]/[sessionId]",
                params: { hostId: host.hostId, sessionId: item.id },
              })
            }
          />
        )}
        ItemSeparatorComponent={ListSeparator}
      />
      <SessionActionsSheet
        host={host}
        row={actionTarget?.row ?? null}
        detail={
          actionTarget
            ? [actionTarget.workspace, actionTarget.row.model]
                .filter(Boolean)
                .join(" · ")
            : null
        }
        onDismiss={() => setActionTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  offline: {
    fontSize: 13,
    paddingHorizontal: layout.sideMargin,
    paddingTop: space.sm,
  },
});
