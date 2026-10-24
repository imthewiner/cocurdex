import { createSavedHostStore } from "@cocurdex/client-runtime";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { secureStorage } from "@/storage";
import { space, useThemeColors } from "@/theme";

const savedHosts = createSavedHostStore(secureStorage);

export function App() {
  const colors = useThemeColors();
  const hostCount = savedHosts.list().length;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.foreground }]}
      >
        Cocurdex
      </Text>
      <Text testID="saved-host-count" style={{ color: colors.mutedForeground }}>
        {hostCount}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  title: { fontSize: 17, fontWeight: "600" },
});
