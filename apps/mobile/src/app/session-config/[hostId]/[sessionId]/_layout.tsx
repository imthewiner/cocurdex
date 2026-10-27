import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { SheetSurface } from "@/theme";
import { useSheetStackOptions } from "@/ui";

function SessionConfigStack() {
  const { t } = useTranslation("sessions");
  const screenOptions = useSheetStackOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "" }} />
      <Stack.Screen name="save-role" options={{ title: t("saveRole.title") }} />
    </Stack>
  );
}

export default function SessionConfigLayout() {
  return (
    <SheetSurface>
      <SessionConfigStack />
    </SheetSurface>
  );
}
