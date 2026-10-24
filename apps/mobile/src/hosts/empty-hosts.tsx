import { Button, Column, Text } from "@expo/ui";
import { StyleSheet, View } from "react-native";
import { space, useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";

export function EmptyHosts({ onPair }: { onPair(): void }) {
  const colors = useThemeColors();
  return (
    <View style={styles.center}>
      <BrandHost matchContents={{ vertical: true }}>
        <Column alignment="center" spacing={space.md}>
          <Text textStyle={{ fontWeight: "600" }}>No Computers</Text>
          <Text
            textStyle={{ color: colors.mutedForeground, textAlign: "center" }}
          >
            On your computer, open Settings › Devices, create a pairing, and
            paste its link here.
          </Text>
          <Button label="Pair a Computer" onPress={onPair} />
        </Column>
      </BrandHost>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", paddingHorizontal: space.lg },
});
