import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EmptyHosts,
  HostSwitcher,
  useCurrentHost,
  usePairingRoutes,
} from "@/hosts";
import { SessionList, sessionsStore } from "@/sessions";

export default function SessionsScreen() {
  const { t } = useTranslation("sessions");
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  const [query, setQuery] = useState("");
  if (!host) {
    return <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: t("search"),
            hideWhenScrolling: false,
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(""),
          },
        }}
      />
      <HostSwitcher current={host} onPair={openPaste} />
      <SessionList
        host={host}
        query={query}
        onReload={() => void sessionsStore(host.hostId).reload()}
      />
    </>
  );
}
