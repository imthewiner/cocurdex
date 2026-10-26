import { ListItem, Text } from "@expo/ui";
import type { ReactNode } from "react";
import { useThemeColors } from "@/theme";
import { sheetRowModifiers } from "./sheet-row-modifiers";

const TRANSPARENT = "#00000000";

export function SheetRow({
  testID,
  label,
  supporting,
  color,
  leading,
  trailing,
  onPress,
}: {
  testID?: string;
  label: string;
  supporting?: string;
  color: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress(): void;
}) {
  const colors = useThemeColors();
  return (
    <ListItem
      testID={testID}
      colors={{
        containerColor: TRANSPARENT,
        supportingContentColor: colors.mutedForeground,
      }}
      modifiers={sheetRowModifiers(supporting !== undefined)}
      onPress={onPress}
      leading={leading}
      trailing={trailing}
      supportingText={
        supporting === undefined ? undefined : (
          <Text textStyle={{ color: colors.mutedForeground, fontSize: 13 }}>
            {supporting}
          </Text>
        )
      }
    >
      <Text textStyle={{ color }}>{label}</Text>
    </ListItem>
  );
}
