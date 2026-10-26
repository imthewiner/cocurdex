import {
  type AgentId,
  countActiveSessionFilters,
  defaultOrderDirection,
  SESSION_ENVIRONMENTS,
  SESSION_GROUPINGS,
  SESSION_ORDER_DIRECTIONS,
  SESSION_ORDERINGS,
  SESSION_ROOT_LIMITS,
  SESSION_STATUS_BUCKETS,
  type SessionListView,
} from "@cocurdex/shared";
import FilterIcon from "@expo/material-symbols/filter_list.xml";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useSessionListLabels } from "./session-list-labels";
import { updateSessionListView } from "./session-list-view-store";

function toggledValue<T>(values: readonly T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function SessionListViewMenu({
  view,
  agents,
  unreadCount,
  onMarkAllRead,
}: {
  view: SessionListView;
  agents: readonly { id: AgentId; label: string }[];
  unreadCount: number;
  onMarkAllRead?(): void;
}) {
  const { t } = useTranslation("sessions");
  const labels = useSessionListLabels();
  const filterCount = countActiveSessionFilters(view);
  return (
    <Stack.Toolbar.Menu
      icon={
        Platform.OS === "ios"
          ? filterCount > 0
            ? "line.3.horizontal.decrease.circle.fill"
            : "line.3.horizontal.decrease.circle"
          : FilterIcon
      }
      accessibilityLabel={t("list.menu")}
    >
      <Stack.Toolbar.Menu title={t("list.groupingLabel")}>
        {SESSION_GROUPINGS.map((grouping) => (
          <Stack.Toolbar.MenuAction
            key={grouping}
            isOn={view.grouping === grouping}
            onPress={() => updateSessionListView({ grouping })}
          >
            {labels.grouping[grouping]}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
      <Stack.Toolbar.Menu title={t("list.orderingLabel")}>
        {SESSION_ORDERINGS.map((ordering) => (
          <Stack.Toolbar.MenuAction
            key={ordering}
            isOn={view.ordering === ordering}
            onPress={() =>
              updateSessionListView({
                ordering,
                direction: defaultOrderDirection(ordering),
              })
            }
          >
            {labels.ordering[ordering]}
          </Stack.Toolbar.MenuAction>
        ))}
        <Stack.Toolbar.Menu inline title="">
          {SESSION_ORDER_DIRECTIONS.map((direction) => (
            <Stack.Toolbar.MenuAction
              key={direction}
              isOn={view.direction === direction}
              onPress={() => updateSessionListView({ direction })}
            >
              {labels.direction[direction]}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>
      <Stack.Toolbar.Menu
        title={
          filterCount > 0
            ? t("list.filtersCount", { count: filterCount })
            : t("list.filtersLabel")
        }
      >
        <Stack.Toolbar.Menu title={t("list.statusFilter")}>
          {SESSION_STATUS_BUCKETS.map((status) => (
            <Stack.Toolbar.MenuAction
              key={status}
              isOn={view.statuses.includes(status)}
              onPress={() =>
                updateSessionListView({
                  statuses: toggledValue(view.statuses, status),
                })
              }
            >
              {labels.status[status]}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu title={t("list.agentFilter")}>
          {agents.map((agent) => (
            <Stack.Toolbar.MenuAction
              key={agent.id}
              isOn={view.agents.includes(agent.id)}
              onPress={() =>
                updateSessionListView({
                  agents: toggledValue(view.agents, agent.id),
                })
              }
            >
              {agent.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu title={t("list.environmentFilter")}>
          {SESSION_ENVIRONMENTS.map((environment) => (
            <Stack.Toolbar.MenuAction
              key={environment}
              isOn={view.environments.includes(environment)}
              onPress={() =>
                updateSessionListView({
                  environments: toggledValue(view.environments, environment),
                })
              }
            >
              {labels.environment[environment]}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        {filterCount > 0 ? (
          <Stack.Toolbar.MenuAction
            onPress={() =>
              updateSessionListView({
                statuses: [],
                agents: [],
                environments: [],
                sources: [],
              })
            }
          >
            {t("list.clearFilters")}
          </Stack.Toolbar.MenuAction>
        ) : null}
      </Stack.Toolbar.Menu>
      <Stack.Toolbar.Menu title={t("list.rootLimitLabel")}>
        {SESSION_ROOT_LIMITS.map((rootLimit) => (
          <Stack.Toolbar.MenuAction
            key={rootLimit}
            isOn={view.rootLimit === rootLimit}
            onPress={() => updateSessionListView({ rootLimit })}
          >
            {labels.rootLimit(rootLimit)}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
      {unreadCount > 0 && onMarkAllRead ? (
        <Stack.Toolbar.MenuAction onPress={onMarkAllRead}>
          {t("list.markAllRead")}
        </Stack.Toolbar.MenuAction>
      ) : null}
    </Stack.Toolbar.Menu>
  );
}
