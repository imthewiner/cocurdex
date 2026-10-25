import { RNHostView } from "@expo/ui";
import type { ReactElement } from "react";
import { Pressable } from "react-native";

export function HostedAccessory({
  children,
  onPress,
}: {
  children: ReactElement;
  onPress?(): void;
}) {
  return (
    <RNHostView matchContents>
      <Pressable disabled={!onPress} onPress={onPress}>
        {children}
      </Pressable>
    </RNHostView>
  );
}
