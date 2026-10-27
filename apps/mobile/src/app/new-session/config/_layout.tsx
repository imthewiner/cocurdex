import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSheetStackOptions } from "@/ui";

export default function NewSessionConfigLayout() {
  const { t } = useTranslation("sessions");
  const screenOptions = useSheetStackOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t("newSession.title") }} />
      <Stack.Screen name="save-role" options={{ title: t("saveRole.title") }} />
    </Stack>
  );
}
