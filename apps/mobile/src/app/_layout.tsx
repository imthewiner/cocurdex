import { Stack, ThemeProvider } from "expo-router";
import { Platform, useColorScheme } from "react-native";
import { navigationThemes } from "@/theme";

const PAIR_PRESENTATION = Platform.OS === "ios" ? "formSheet" : "modal";

export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <ThemeProvider value={navigationThemes[scheme]}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{ title: "Computers", headerLargeTitle: true }}
        />
        <Stack.Screen
          name="pair"
          options={{
            title: "Pair a Computer",
            presentation: PAIR_PRESENTATION,
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
