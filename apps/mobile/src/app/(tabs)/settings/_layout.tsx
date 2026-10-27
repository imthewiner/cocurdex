import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useGroupedColors } from "@/theme";

export default function SettingsLayout() {
  const { t } = useTranslation();
  const grouped = useGroupedColors();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: t("screens.settings"),
          headerLargeTitle: true,
          headerStyle: { backgroundColor: grouped.page },
          contentStyle: { backgroundColor: grouped.page },
        }}
      />
    </Stack>
  );
}
