import AddIcon from "@expo/material-symbols/add.xml";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform } from "react-native";
import {
  EmptyHosts,
  useCurrentHost,
  usePairingRoutes,
  useScopeGate,
} from "@/hosts";
import { createBlankNote, NoteList } from "@/notes";
import { emptyListOptions, useListHeader } from "@/ui";

export default function NotesScreen() {
  const { t } = useTranslation(["notes", "common"]);
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  const router = useRouter();
  const gate = useScopeGate(host);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const listHeader = useListHeader({
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
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "square.and.pencil" : AddIcon}
          accessibilityLabel={t("create.open")}
          disabled={creating}
          onPress={gate("interact", () => {
            setCreating(true);
            createBlankNote(host.hostId)
              .then((note) =>
                router.push({
                  pathname: "/note/[hostId]/[noteId]",
                  params: {
                    hostId: host.hostId,
                    noteId: note.id,
                    created: "1",
                  },
                }),
              )
              .catch(() => Alert.alert(t("create.failed")))
              .finally(() => setCreating(false));
          })}
        />
      </Stack.Toolbar>
      <NoteList host={host} query={query} />
    </>
  );
}
