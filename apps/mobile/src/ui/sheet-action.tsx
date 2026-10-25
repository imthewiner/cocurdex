import { Button } from "@expo/ui";
import { Stack } from "expo-router";
import { BrandHost } from "./brand-host";
import type { SheetActionProps } from "./sheet-action-props";

export function SheetAction({ label, disabled, onPress }: SheetActionProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.View>
        <BrandHost matchContents>
          <Button
            variant="text"
            label={label}
            disabled={disabled}
            onPress={onPress}
          />
        </BrandHost>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
