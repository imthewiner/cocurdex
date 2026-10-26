import { ListItem, Text } from "@expo/ui";
import type { ReactNode } from "react";
import { SHEET_ROW_MODIFIERS } from "./sheet-row-modifiers";

const TRANSPARENT = "#00000000";

export function SheetRow({
  testID,
  label,
  color,
  leading,
  trailing,
  onPress,
}: {
  testID?: string;
  label: string;
  color: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress(): void;
}) {
  return (
    <ListItem
      testID={testID}
      colors={{ containerColor: TRANSPARENT }}
      modifiers={SHEET_ROW_MODIFIERS}
      onPress={onPress}
      leading={leading}
      trailing={trailing}
    >
      <Text textStyle={{ color }}>{label}</Text>
    </ListItem>
  );
}
