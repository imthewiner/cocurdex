import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function SessionsLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: t("screens.sessions"), headerLargeTitle: true }}
      />
      <Stack.Screen
        name="session/[hostId]/[sessionId]"
        options={{ title: "", headerBackButtonDisplayMode: "minimal" }}
      />
    </Stack>
  );
}
