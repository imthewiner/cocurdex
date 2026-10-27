import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSheetStackOptions } from "@/ui";

export default function ListOptionsLayout() {
  const { t } = useTranslation("sessions");
  const screenOptions = useSheetStackOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t("list.options.title") }} />
      <Stack.Screen name="[field]" />
    </Stack>
  );
}
