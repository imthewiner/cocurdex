import { Stack } from "expo-router";
import type { PairToolbarProps } from "./pair-toolbar-props";

export function PairToolbar({ label, disabled, onPair }: PairToolbarProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button variant="done" disabled={disabled} onPress={onPair}>
        {label}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
