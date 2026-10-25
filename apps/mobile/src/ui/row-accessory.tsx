import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { space, useThemeColors } from "@/theme";
import { HostedAccessory } from "@/ui";

export function SelectedMark({ selected }: { selected: boolean }) {
  const colors = useThemeColors();
  if (!selected) return null;
  return (
    <HostedAccessory>
      <SymbolView
        name={{ ios: "checkmark", android: "check" }}
        size={18}
        tintColor={colors.tint}
      />
    </HostedAccessory>
  );
}

export function RowValue({
  value,
  detail,
}: {
  value: string;
  detail?: string | null;
}) {
  const colors = useThemeColors();
  return (
    <HostedAccessory>
      <View style={styles.row}>
        <View style={styles.values}>
          <Text
            numberOfLines={1}
            style={[styles.value, { color: colors.mutedForeground }]}
          >
            {value}
          </Text>
          {detail ? (
            <Text
              numberOfLines={1}
              style={[styles.detail, { color: colors.mutedForeground }]}
            >
              {detail}
            </Text>
          ) : null}
        </View>
        <SymbolView
          name={{ ios: "chevron.right", android: "chevron_right" }}
          size={13}
          tintColor={colors.mutedForeground}
        />
      </View>
    </HostedAccessory>
  );
}

export function FolderIcon() {
  const colors = useThemeColors();
  return (
    <HostedAccessory>
      <SymbolView
        name={{ ios: "folder", android: "folder" }}
        size={20}
        tintColor={colors.mutedForeground}
      />
    </HostedAccessory>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  values: { alignItems: "flex-end" },
  value: { fontSize: 17 },
  detail: { fontSize: 13 },
});
