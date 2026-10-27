import CloseIcon from "@expo/material-symbols/close.xml";
import { Stack } from "expo-router";
import { useThemeColors } from "@/theme";
import type { CloseButtonProps } from "./close-button-props";

export function CloseButton(_props: CloseButtonProps) {
  const colors = useThemeColors();
  return (
    <Stack.Screen
      options={{
        headerBackVisible: true,
        headerBackImageSource: CloseIcon,
        headerTintColor: colors.foreground,
      }}
    />
  );
}
