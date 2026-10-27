import type { SavedHost } from "@cocurdex/client-runtime";
import type { IssueRecord } from "@cocurdex/shared";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { hostConnection } from "@/connection";
import { useScopeGate } from "@/hosts";
import { layout, space, useThemeColors } from "@/theme";
import {
  ListNotice,
  PendingIndicator,
  useOptionSheet,
  usePullToRefresh,
} from "@/ui";
import { IssueCard } from "./issue-card";
import { useIssueView } from "./issue-queries";
import {
  type IssueSection,
  issueSections,
  withIssueStatus,
} from "./issue-sections";
import { IssueStatusMark } from "./issue-status-mark";

const COLUMN_GAP = space.md;
const CARD_GAP = space.sm;

export function IssueBoard({
  host,
  workspaceId,
  query,
}: {
  host: SavedHost;
  workspaceId: string | null;
  query: string;
}) {
  const { t } = useTranslation("issues");
  const colors = useThemeColors();
  const router = useRouter();
  const gate = useScopeGate(host);
  const optionSheet = useOptionSheet();
  const { width } = useWindowDimensions();
  const columnWidth = width - layout.boardColumnPeek;
  const view = useIssueView(host.hostId);
  const data = view.data;
  const pull = usePullToRefresh(() => view.mutate());
  const columns = useMemo(
    () =>
      data
        ? issueSections(data.issues, data.statusOptions, workspaceId, query, {
            includeEmpty: true,
          })
        : [],
    [data, workspaceId, query],
  );
  const priorityTitles = useMemo(
    () =>
      new Map(
        data?.priorityOptions.map((option) => [option.id, option.title]) ?? [],
      ),
    [data],
  );

  if (!data) {
    if (data === undefined && !view.error) return <PendingIndicator />;
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

  const move = (issue: IssueRecord, statusId: string) => {
    if (statusId === issue.status) return;
    const update = hostConnection(host.hostId)
      .request("issue.update", {
        viewId: data.view.id,
        id: issue.id,
        status: statusId,
        expectedRevision: issue.revision,
      })
      .then(() => undefined);
    view
      .mutate(update, {
        optimisticData: withIssueStatus(data, issue.id, statusId),
        populateCache: false,
        revalidate: true,
        rollbackOnError: true,
      })
      .catch(() => Alert.alert(t("board.moveFailed")));
  };

  const openMove = (issue: IssueRecord) =>
    optionSheet.open({
      title: t("board.moveTitle"),
      subtitle: issue.title,
      items: columns.map(({ status }) => ({
        key: status.id,
        label: status.title,
        leading: (
          <IssueStatusMark category={status.category} label={status.title} />
        ),
        selected: status.id === issue.status,
        testID: `issue-move-${status.id}`,
        onPress: gate("interact", () => move(issue, status.id)),
      })),
    });

  const renderColumn = ({ item: column }: { item: IssueSection }) => (
    <FlatList
      style={{ width: columnWidth }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      data={column.issues}
      keyExtractor={(issue) => issue.id}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      testID={`issue-column-${column.status.id}`}
      ListHeaderComponent={
        <View accessibilityRole="header" style={styles.columnHead}>
          <IssueStatusMark
            category={column.status.category}
            label={column.status.title}
          />
          <Text style={[styles.columnTitle, { color: colors.foreground }]}>
            {column.status.title}
          </Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {column.issues.length}
          </Text>
        </View>
      }
      ItemSeparatorComponent={CardGap}
      renderItem={({ item: issue }) => (
        <IssueCard
          issue={issue}
          statusTitle={column.status.title}
          priorityTitle={priorityTitles.get(issue.priority) ?? null}
          onPress={() =>
            router.push({
              pathname: "/issue/[hostId]/[issueId]",
              params: { hostId: host.hostId, issueId: issue.id },
            })
          }
          onMove={() => openMove(issue)}
        />
      )}
    />
  );

  return (
    <View style={styles.fill}>
      <FlatList
        horizontal
        style={styles.fill}
        showsHorizontalScrollIndicator={false}
        snapToInterval={columnWidth + COLUMN_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.board}
        data={columns}
        keyExtractor={(column) => column.status.id}
        renderItem={renderColumn}
        testID="issue-board"
      />
      {optionSheet.sheet}
    </View>
  );
}

function CardGap() {
  return <View style={styles.cardGap} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  board: { paddingHorizontal: layout.sideMargin, gap: COLUMN_GAP },
  columnHead: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  columnTitle: { fontSize: 15, fontWeight: "600" },
  count: { fontSize: 13 },
  cardGap: { height: CARD_GAP },
});
