import { Button, ContentUnavailableView, VStack } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, tint } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { space, useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";

export function EmptyHosts({ onPair }: { onPair(): void }) {
  const colors = useThemeColors();
  return (
    <BrandHost style={styles.fill}>
      <VStack spacing={space.lg}>
        <ContentUnavailableView
          title="No Computers"
          systemImage="desktopcomputer"
          description="On your computer, open Settings › Devices, create a pairing, and paste its link here."
        />
        <Button
          label="Pair a Computer"
          onPress={onPair}
          modifiers={[
            buttonStyle("borderedProminent"),
            controlSize("large"),
            tint(colors.primary),
          ]}
        />
      </VStack>
    </BrandHost>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
