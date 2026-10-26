import type { SavedHost } from "@cocurdex/client-runtime";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AgentIcon, usePermissionModeLabels } from "@/agents";
import { runtimeSummary, useRuntimeLabels } from "@/session-runtime";
import { space, useThemeColors } from "@/theme";
import { useSessionConfigState } from "./session-config-state";

function Chip({
  label,
  testID,
  accessibilityLabel,
  leading,
  onPress,
}: {
  label: string;
  testID: string;
  accessibilityLabel: string;
  leading?: ReactNode;
  onPress(): void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {leading}
      <Text
        numberOfLines={1}
        style={[styles.label, { color: colors.mutedForeground }]}
      >
        {label}
      </Text>
      <SymbolView
        name={{ ios: "chevron.down", android: "keyboard_arrow_down" }}
        size={12}
        tintColor={colors.mutedForeground}
      />
    </Pressable>
  );
}

export function SessionConfigChips({
  host,
  sessionId,
}: {
  host: SavedHost;
  sessionId: string;
}) {
  const { t } = useTranslation("sessions");
  const runtimeLabels = useRuntimeLabels();
  const modeLabels = usePermissionModeLabels();
  const { session, agent, snapshot, axes } = useSessionConfigState(
    host,
    sessionId,
  );
  if (!session) return null;
  const open = () =>
    router.push({
      pathname: "/session-config/[hostId]/[sessionId]",
      params: { hostId: host.hostId, sessionId },
    });
  const summary = [
    snapshot?.modelName ?? agent?.label ?? session.agentType,
    ...(axes ? runtimeSummary(axes, runtimeLabels) : []),
  ].join(" · ");
  const mode = session.permissionMode;
  return (
    <View style={styles.row}>
      <Chip
        testID="session-config-chip"
        accessibilityLabel={t("sessionConfig.open", { summary })}
        label={summary}
        leading={<AgentIcon agentId={session.agentType} size={14} />}
        onPress={open}
      />
      {mode ? (
        <Chip
          testID="session-config-mode-chip"
          accessibilityLabel={t("sessionConfig.openMode", {
            mode: modeLabels[mode].label,
          })}
          label={modeLabels[mode].label}
          onPress={open}
        />
      ) : null}
    </View>
  );
}

const CHIP_HEIGHT = 32;

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minWidth: 0,
  },
  chip: {
    flexShrink: 1,
    minWidth: 0,
    height: CHIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
  pressed: { opacity: 0.5 },
  label: { flexShrink: 1, fontSize: 14 },
});
