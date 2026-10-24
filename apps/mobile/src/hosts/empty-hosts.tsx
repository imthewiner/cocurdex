import { Button, Column, Text } from "@expo/ui";
import { StyleSheet } from "react-native";
import { space, useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";

export function EmptyHosts({ onPair }: { onPair(): void }) {
  const colors = useThemeColors();
  return (
    <BrandHost style={styles.fill} useViewportSizeMeasurement>
      <Column alignment="center" spacing={space.md}>
        <Text textStyle={{ fontWeight: "600" }}>No Computers</Text>
        <Text
          textStyle={{ color: colors.mutedForeground, textAlign: "center" }}
        >
          On your computer, open Settings › Devices, create a pairing, and paste
          its link here.
        </Text>
        <Button label="Pair a Computer" onPress={onPair} />
      </Column>
    </BrandHost>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
