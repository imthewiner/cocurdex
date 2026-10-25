import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useGroupedColors } from "@/theme";

const PUSH_ANIMATION =
  Platform.OS === "android" ? "slide_from_right" : "default";

export default function NewSessionLayout() {
  const { t } = useTranslation("sessions");
  const grouped = useGroupedColors();
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerTitleAlign: "center",
        animation: PUSH_ANIMATION,
        headerStyle: { backgroundColor: grouped.page },
        contentStyle: { backgroundColor: grouped.page },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("newSession.title") }} />
      <Stack.Screen
        name="workspace"
        options={{ title: t("newSession.workspace") }}
      />
      <Stack.Screen name="agent" options={{ title: t("newSession.agent") }} />
    </Stack>
  );
}
