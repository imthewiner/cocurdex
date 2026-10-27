import AddIcon from "@expo/material-symbols/add.xml";
import SettingsIcon from "@expo/material-symbols/settings.xml";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { HostsList } from "@/computers";
import { EmptyHosts, usePairingRoutes, useSavedHosts } from "@/hosts";
import { emptyListOptions, headerLeading, useListHeader } from "@/ui";

export default function ComputersScreen() {
  const { t } = useTranslation();
  const { openPaste, openScan } = usePairingRoutes();
  const hasHosts = useSavedHosts().length > 0;
  const listHeader = useListHeader(t("screens.computers"));

  return (
    <>
      <Stack.Screen
        options={
          hasHosts
            ? listHeader.options
            : emptyListOptions(t("screens.computers"))
        }
      />
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
        <HostsList header={listHeader.header} />
      ) : (
        <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />
      )}
    </>
  );
}
