import { Stack } from "expo-router";
import type { SheetActionProps } from "./sheet-action-props";

export function SheetAction({ label, disabled, onPress }: SheetActionProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        variant="done"
        disabled={disabled}
        onPress={onPress}
      >
        {label}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
