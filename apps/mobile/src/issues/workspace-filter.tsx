import type { SavedHost } from "@cocurdex/client-runtime";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useHostSessions } from "@/sessions";
import { layout, space, useThemeColors } from "@/theme";

const CHIP_HEIGHT = 34;

function WorkspaceChip({
  label,
  selected,
  testID,
  onPress,
}: {
  label: string;
  selected: boolean;
  testID: string;
  onPress(): void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected && {
          backgroundColor: colors.muted,
          borderColor: colors.border,
        },
      ]}
      testID={testID}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: selected ? colors.foreground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function WorkspaceChips({
  host,
  workspaceId,
  onChange,
}: {
  host: SavedHost;
  workspaceId: string | null;
  onChange(workspaceId: string | null): void;
}) {
  const { t } = useTranslation("issues");
  const { workspaces } = useHostSessions(host.hostId);
  if (workspaces.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      testID="workspace-chips"
    >
      <WorkspaceChip
        label={t("allWorkspaces")}
        selected={workspaceId === null}
        testID="workspace-chip-all"
        onPress={() => onChange(null)}
      />
      {workspaces.map((workspace) => (
        <WorkspaceChip
          key={workspace.id}
          label={workspace.name}
          selected={workspace.id === workspaceId}
          testID={`workspace-chip-${workspace.id}`}
          onPress={() => onChange(workspace.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: space.xs,
    paddingHorizontal: layout.sideMargin - space.sm,
    paddingVertical: space.sm,
  },
  chip: {
    height: CHIP_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: CHIP_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  label: { fontSize: 15 },
});
