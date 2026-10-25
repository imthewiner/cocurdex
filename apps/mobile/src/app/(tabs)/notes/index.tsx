import AddIcon from "@expo/material-symbols/add.xml";
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
import { NoteList } from "@/notes";
import { useSearchBarOptions } from "@/ui";

export default function NotesScreen() {
  const { t } = useTranslation("notes");
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchBarOptions = useSearchBarOptions(t("search"), setQuery);
  if (!host) {
    return <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: searchBarOptions,
        }}
      />
      <HostSwitcher current={host} onPair={openPaste} />
      {host.scopes.includes("interact") ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "square.and.pencil" : AddIcon}
            accessibilityLabel={t("create.open")}
            onPress={() =>
              router.push({
                pathname: "/new-note/[hostId]",
                params: { hostId: host.hostId },
              })
            }
          />
        </Stack.Toolbar>
      ) : null}
      <NoteList host={host} query={query} />
    </>
  );
}
