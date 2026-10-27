import { Text as LabelText } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { space, useThemeColors } from "@/theme";
import { FormRow } from "./form-row";
import { HostedAccessory } from "./hosted-accessory";

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
  icon,
  onPress,
}: {
  value: string;
  detail?: string | null;
  icon?: ReactNode;
  onPress?(): void;
}) {
  const colors = useThemeColors();
  return (
    <HostedAccessory onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.values}>
          <View style={styles.valueLine}>
            {icon}
            <Text
              numberOfLines={1}
              style={[styles.value, { color: colors.mutedForeground }]}
            >
              {value}
            </Text>
          </View>
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
  valueLine: { flexDirection: "row", alignItems: "center", gap: space.xs },
  values: { alignItems: "flex-end" },
  value: { fontSize: 17 },
  detail: { fontSize: 13 },
});

export function ValueFormRow({
  testID,
  label,
  value,
  detail,
  icon,
  onPress,
}: {
  testID: string;
  label: string;
  value: string;
  detail?: string | null;
  icon?: ReactNode;
  onPress(): void;
}) {
  return (
    <FormRow
      testID={testID}
      onPress={onPress}
      trailing={
        <RowValue value={value} detail={detail} icon={icon} onPress={onPress} />
      }
    >
      <LabelText>{label}</LabelText>
    </FormRow>
  );
}
