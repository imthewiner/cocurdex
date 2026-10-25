import CloseIcon from "@expo/material-symbols/close.xml";
import { Stack } from "expo-router";
import type { CloseButtonProps } from "./close-button-props";

export function CloseButton(_props: CloseButtonProps) {
  return (
    <Stack.Screen
      options={{ headerBackVisible: true, headerBackImageSource: CloseIcon }}
    />
  );
}
