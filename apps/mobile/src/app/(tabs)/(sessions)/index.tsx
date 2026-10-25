import EditSquareIcon from "@expo/material-symbols/edit_square.xml";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import {
  EmptyHosts,
  HostSwitcher,
  useCurrentHost,
  usePairingRoutes,
} from "@/hosts";
import { beginNewSession } from "@/new-session";
import { SessionList, sessionsStore } from "@/sessions";

export default function SessionsScreen() {
  const { t } = useTranslation("sessions");
  const { openPaste, openScan } = usePairingRoutes();
  const router = useRouter();
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
      {host.scopes.includes("execute") ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "square.and.pencil" : EditSquareIcon}
            accessibilityLabel={t("newSession.open")}
            onPress={() => {
              beginNewSession(host.hostId);
              router.push("/new-session");
            }}
          />
        </Stack.Toolbar>
      ) : null}
      <SessionList
        host={host}
        query={query}
        onReload={() => void sessionsStore(host.hostId).reload()}
      />
    </>
  );
}
