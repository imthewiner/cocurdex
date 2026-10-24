import "@/i18n";
import { Stack, ThemeProvider } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, useColorScheme } from "react-native";
import { navigationThemes } from "@/theme";

const PAIR_PRESENTATION = Platform.OS === "ios" ? "formSheet" : "modal";

export default function RootLayout() {
  const { t } = useTranslation();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <ThemeProvider value={navigationThemes[scheme]}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="pair"
          options={{
            title: t("screens.pair"),
            presentation: PAIR_PRESENTATION,
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
