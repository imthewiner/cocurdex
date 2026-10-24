import { Stack, ThemeProvider } from "expo-router";
import { useColorScheme } from "react-native";
import { navigationThemes, themeColors } from "@/theme";

export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <ThemeProvider value={navigationThemes[scheme]}>
      <Stack screenOptions={{ headerTintColor: themeColors[scheme].tint }}>
        <Stack.Screen
          name="index"
          options={{ title: "Computers", headerLargeTitle: true }}
        />
        <Stack.Screen
          name="pair"
          options={{
            title: "Pair a Computer",
            presentation: "formSheet",
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
