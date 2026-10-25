import AddIcon from "@expo/material-symbols/add.xml";
import SettingsIcon from "@expo/material-symbols/settings.xml";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import {
  EmptyHosts,
  HostsList,
  usePairingRoutes,
  useSavedHosts,
} from "@/hosts";
import { headerLeading } from "@/ui";

export default function ComputersScreen() {
  const { t } = useTranslation();
  const { openPaste, openScan } = usePairingRoutes();
  const hasHosts = useSavedHosts().length > 0;

  return (
    <>
      <Stack.Toolbar placement="left">
        {headerLeading(
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "gearshape" : SettingsIcon}
            accessibilityLabel={t("screens.settings")}
            onPress={() => router.push("/settings")}
          />,
        )}
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "plus" : AddIcon}
          accessibilityLabel={t("screens.pair")}
          onPress={openPaste}
        />
      </Stack.Toolbar>
      {hasHosts ? (
        <HostsList />
      ) : (
        <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />
      )}
    </>
  );
}
