import type { SessionPrimaryState } from "@cocurdex/shared";
import ExpandedIcon from "@expo/material-symbols/keyboard_arrow_down.xml";
import CollapsedIcon from "@expo/material-symbols/keyboard_arrow_right.xml";
import { Icon } from "@expo/ui";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AgentIcon, RoleAvatar, type RoleAvatarSource } from "@/agents";
import { layout, space, useThemeColors } from "@/theme";
import { useAgeLabel } from "@/ui";
import { type SessionRow, sessionRowStatus } from "./session-sections";
import { SessionStatusMark } from "./session-status-mark";

function useStateDetails(): Record<SessionPrimaryState, string | null> {
  const { t } = useTranslation("sessions");
  return {
    "pending-approval": t("detail.pendingApproval"),
    "awaiting-input": t("detail.awaitingInput"),
    "plan-ready": t("detail.planReady"),
    failed: t("detail.failed"),
    working: t("detail.working"),
    connecting: t("detail.connecting"),
    monitoring: t("detail.monitoring"),
    "completed-unread": t("detail.completedUnread"),
    ready: null,
  };
}

function MetaIcon({
  row,
  role,
}: {
  row: SessionRow;
  role: RoleAvatarSource | null;
}) {
  return (
    <View style={styles.metaIcon}>
      {role ? (
        <RoleAvatar role={role} agentId={row.agentType} size={18} />
      ) : (
        <AgentIcon agentId={row.agentType} size={14} />
      )}
    </View>
  );
}

const CHILD_INDENT = 20;
const DISCLOSURE_SLOP = { top: 12, bottom: 12, left: 12, right: 8 };

function ChildrenDisclosure({
  expanded,
  onPress,
}: {
  expanded: boolean;
  onPress(): void;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        expanded ? t("list.collapseChildren") : t("list.expandChildren")
      }
      accessibilityState={{ expanded }}
      hitSlop={DISCLOSURE_SLOP}
      onPress={onPress}
      style={styles.disclosure}
    >
      <Icon
        name={
          expanded
            ? { ios: "chevron.down", android: ExpandedIcon }
            : { ios: "chevron.right", android: CollapsedIcon }
        }
        size={14}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

export function SessionRowView({
  row,
  role,
  onPress,
  onLongPress,
  onToggleChildren,
}: {
  row: SessionRow;
  role: RoleAvatarSource | null;
  onPress(): void;
  onLongPress(): void;
  onToggleChildren(): void;
}) {
  const colors = useThemeColors();
  const age = useAgeLabel(row.activityAt);
  const detail = useStateDetails()[row.state];
  const status = sessionRowStatus(row.state);
  const detailColor =
    status === "failed" ? colors.destructive : colors.mutedForeground;
  const secondary = [role?.name, detail ?? row.model]
    .filter(Boolean)
    .join(" · ");
  const summary = [role?.name, detail, age].filter(Boolean).join(", ");
  return (
    <Pressable
      accessibilityLabel={row.title}
      accessibilityRole="button"
      accessibilityValue={{ text: summary }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        { paddingStart: layout.sideMargin + row.depth * CHILD_INDENT },
        pressed && { backgroundColor: colors.muted },
      ]}
      testID={`session-row-${row.id}`}
    >
      <View style={styles.line}>
        {row.hasChildren ? (
          <ChildrenDisclosure
            expanded={row.expanded}
            onPress={onToggleChildren}
          />
        ) : null}
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.foreground }]}
        >
          {row.title}
        </Text>
        <Text style={[styles.age, { color: colors.mutedForeground }]}>
          {age}
        </Text>
      </View>
      <View style={styles.line}>
        <View style={styles.meta}>
          <MetaIcon row={row} role={role} />
          <Text
            numberOfLines={1}
            style={[styles.detail, { color: detailColor }]}
          >
            {secondary}
          </Text>
        </View>
        <SessionStatusMark status={status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    justifyContent: "center",
    gap: 2,
    paddingVertical: space.sm,
    paddingEnd: layout.sideMargin,
  },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm },
  disclosure: { width: 16, alignItems: "center", marginEnd: -space.xs },
  title: { flex: 1, fontSize: 16, lineHeight: 22 },
  age: { fontSize: 13, fontVariant: ["tabular-nums"] },
  meta: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  metaIcon: { width: 18, alignItems: "center" },
  detail: { flex: 1, fontSize: 14, lineHeight: 19 },
});
