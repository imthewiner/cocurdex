import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSheetStackOptions } from "@/ui";

export default function IssueFiltersLayout() {
  const { t } = useTranslation("issues");
  const screenOptions = useSheetStackOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t("filter.title") }} />
      <Stack.Screen name="[field]" />
    </Stack>
  );
}
