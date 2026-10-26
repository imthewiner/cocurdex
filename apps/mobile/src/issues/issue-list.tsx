import type { SavedHost } from "@cocurdex/client-runtime";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, StyleSheet, View } from "react-native";
import {
  ListNotice,
  ListSectionHeader,
  ListSeparator,
  usePullToRefresh,
} from "@/ui";
import { useIssueView } from "./issue-queries";
import { IssueRowView } from "./issue-row";
import { issueSections } from "./issue-sections";

export function IssueList({
  host,
  workspaceId,
  query,
}: {
  host: SavedHost;
  workspaceId: string | null;
  query: string;
}) {
  const { t } = useTranslation("issues");
  const router = useRouter();
  const view = useIssueView(host.hostId);
  const data = view.data;
  const pull = usePullToRefresh(() => view.mutate());
  const sections = useMemo(
    () =>
      data
        ? issueSections(
            data.issues,
            data.statusOptions,
            workspaceId,
            query,
          ).map((section) => ({
            key: section.status.id,
            status: section.status,
            data: section.issues,
          }))
        : [],
    [data, workspaceId, query],
  );
  const labelNames = useMemo(
    () => new Map(data?.labels.map((label) => [label.id, label.name]) ?? []),
    [data],
  );

  if (!data) {
    if (data === undefined && !view.error) return <View style={styles.fill} />;
    return (
      <ListNotice
        title={t("unavailable.title", { host: host.name })}
        action={{
          label: t("unavailable.retry"),
          onPress: () => void view.mutate(),
        }}
      />
    );
  }

  const searching = query.trim() !== "";
  return (
    <SectionList
      style={styles.fill}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      sections={sections}
      keyExtractor={(issue) => issue.id}
      stickySectionHeadersEnabled={false}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
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
        <ListSectionHeader
          title={t("sectionTitle", {
            status: section.status.title,
            count: section.data.length,
          })}
        />
      )}
      renderItem={({ item, section }) => (
        <IssueRowView
          issue={item}
          statusTitle={section.status.title}
          labelNames={item.labelIds.flatMap((id) => labelNames.get(id) ?? [])}
          onPress={() =>
            router.push({
              pathname: "/issue/[hostId]/[issueId]",
              params: { hostId: host.hostId, issueId: item.id },
            })
          }
        />
      )}
      ItemSeparatorComponent={ListSeparator}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
