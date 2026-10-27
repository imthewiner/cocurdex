import type { SavedHost } from "@cocurdex/client-runtime";
import type { AgentId } from "@cocurdex/shared";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, SectionList, StyleSheet, Text } from "react-native";
import { useAgentRoles } from "@/agents";
import { layout, space, useThemeColors } from "@/theme";
import {
  ListNotice,
  ListSectionHeader,
  ListSeparator,
  PendingIndicator,
  useScrollIndicatorWhileScrolling,
} from "@/ui";
import { SessionActionsSheet } from "./session-actions-sheet";
import { useSessionListLabels } from "./session-list-labels";
import {
  toggleSectionExpanded,
  toggleSessionChildren,
  useSessionListUi,
} from "./session-list-view-store";
import { ChildrenToggle, SessionRowView } from "./session-row";
import {
  buildSessionSections,
  type SessionRow,
  type SessionSection,
  type SessionSectionHeading,
} from "./session-sections";
import { useHostSessions } from "./sessions";
import type { HostSessionsSnapshot } from "./sessions-store";

const OFFLINE_STATES = new Set<HostSessionsSnapshot["connection"]>([
  "retrying",
  "waiting",
]);

function useHeadingTitle(agentLabels: ReadonlyMap<AgentId, string>) {
  const { t } = useTranslation("sessions");
  const labels = useSessionListLabels();
  return (heading: SessionSectionHeading) => {
    switch (heading.kind) {
      case "pinned":
        return t("list.pinned");
      case "workspace":
        return heading.name;
      case "status":
        return labels.status[heading.value];
      case "updated":
        return labels.updated[heading.value];
      case "agent":
        return agentLabels.get(heading.value) ?? heading.value;
      default:
        return null;
    }
  };
}

function SectionFooter({ section }: { section: SessionSection }) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const { expandedSectionKeys } = useSessionListUi();
  const expanded = expandedSectionKeys.has(section.key);
  if (section.hiddenCount === 0 && !expanded) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => toggleSectionExpanded(section.key)}
      style={({ pressed }) => [
        styles.footer,
        pressed && { backgroundColor: colors.muted },
      ]}
      testID={`session-section-more-${section.key}`}
    >
      <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>
        {expanded
          ? t("list.showLess")
          : t("list.showMore", { count: section.hiddenCount })}
      </Text>
    </Pressable>
  );
}

export function SessionList({
  host,
  query,
  agentLabels,
  onReload,
}: {
  host: SavedHost;
  query: string;
  agentLabels: ReadonlyMap<AgentId, string>;
  onReload(): void;
}) {
  const scrollIndicator = useScrollIndicatorWhileScrolling();
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const router = useRouter();
  const snapshot = useHostSessions(host.hostId);
  const ui = useSessionListUi();
  const roles = useAgentRoles(host.hostId).data;
  const roleById = new Map(roles?.map((role) => [role.id, role]));
  const headingTitle = useHeadingTitle(agentLabels);
  const [actionTarget, setActionTarget] = useState<SessionRow | null>(null);
  const sections = useMemo(
    () =>
      buildSessionSections({
        workspaces: snapshot.workspaces,
        sessions: snapshot.sessions,
        attention: snapshot.attention,
        query,
        view: ui.view,
        collapsedIds: ui.collapsedIds,
        expandedSectionKeys: ui.expandedSectionKeys,
        now: new Date(),
      }).map((section) => ({ ...section, data: section.rows })),
    [snapshot.workspaces, snapshot.sessions, snapshot.attention, query, ui],
  );

  if (!snapshot.loaded) {
    if (!snapshot.failed) return <PendingIndicator />;
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
  const filtering =
    ui.view.statuses.length +
      ui.view.agents.length +
      ui.view.environments.length >
    0;

  return (
    <>
      <SectionList<SessionRow, SessionSection>
        {...scrollIndicator}
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
          ) : filtering ? (
            <ListNotice title={t("list.noMatches")} />
          ) : (
            <ListNotice
              title={t("empty.title")}
              description={t("empty.description", { host: host.name })}
            />
          )
        }
        renderSectionHeader={({ section }) => {
          const title = headingTitle(section.heading);
          return title ? <ListSectionHeader title={title} /> : null;
        }}
        renderSectionFooter={({ section }) => (
          <SectionFooter section={section} />
        )}
        renderItem={({ item }) => (
          <>
            <SessionRowView
              row={item}
              role={item.roleId ? (roleById.get(item.roleId) ?? null) : null}
              onLongPress={() => setActionTarget(item)}
              onPress={() =>
                router.push({
                  pathname: "/session/[hostId]/[sessionId]",
                  params: { hostId: host.hostId, sessionId: item.id },
                })
              }
            />
            {item.hasChildren ? (
              <ChildrenToggle
                row={item}
                onPress={() => toggleSessionChildren(item.id)}
              />
            ) : null}
          </>
        )}
        ItemSeparatorComponent={ListSeparator}
      />
      <SessionActionsSheet
        host={host}
        row={actionTarget}
        detail={
          actionTarget
            ? [actionTarget.workspaceName, actionTarget.model]
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
  footer: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: layout.sideMargin,
  },
  footerLabel: { fontSize: 14 },
});
