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
  useScopeGate,
} from "@/hosts";
import { NoteList } from "@/notes";
import { emptyListOptions, useListHeader } from "@/ui";

export default function NotesScreen() {
  const { t } = useTranslation(["notes", "common"]);
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  const router = useRouter();
  const gate = useScopeGate(host);
  const [query, setQuery] = useState("");
  const listHeader = useListHeader(t("common:screens.notes"), {
    placeholder: t("search"),
    onQuery: setQuery,
  });
  if (!host) {
    return (
      <>
        <Stack.Screen options={emptyListOptions(t("common:screens.notes"))} />
        <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={listHeader.options} />
      <HostSwitcher current={host} onPair={openPaste} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "square.and.pencil" : AddIcon}
          accessibilityLabel={t("create.open")}
          onPress={gate("interact", () =>
            router.push({
              pathname: "/new-note/[hostId]",
              params: { hostId: host.hostId },
            }),
          )}
        />
      </Stack.Toolbar>
      <NoteList host={host} query={query} header={listHeader.header} />
    </>
  );
}
