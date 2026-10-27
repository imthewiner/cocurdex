import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useGroupedColors } from "@/theme";

const PUSH_ANIMATION =
  Platform.OS === "android" ? "slide_from_right" : "default";

export default function SettingsLayout() {
  const { t } = useTranslation();
  const grouped = useGroupedColors();
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: t("screens.settings"),
          headerShown: false,
          contentStyle: { backgroundColor: grouped.page },
        }}
      />
      <Stack.Screen
        name="language"
        options={{
          title: t("screens.language"),
          headerBackButtonDisplayMode: "minimal",
          animation: PUSH_ANIMATION,
          headerStyle: { backgroundColor: grouped.page },
          contentStyle: { backgroundColor: grouped.page },
        }}
      />
    </Stack>
  );
}
