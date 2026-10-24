import { Button } from "@expo/ui";
import { Stack } from "expo-router";
import { BrandHost } from "@/ui";
import type { PairToolbarProps } from "./pair-toolbar-props";

export function PairToolbar({ label, disabled, onPair }: PairToolbarProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.View>
        <BrandHost matchContents>
          <Button
            variant="text"
            label={label}
            disabled={disabled}
            onPress={onPair}
          />
        </BrandHost>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
