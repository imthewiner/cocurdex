import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EmptyHosts,
  HostSwitcher,
  useCurrentHost,
  usePairingRoutes,
} from "@/hosts";
import { IssueList, WorkspaceFilter } from "@/issues";

export default function IssuesScreen() {
  const { t } = useTranslation("issues");
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  const [query, setQuery] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
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
      <WorkspaceFilter
        host={host}
        workspaceId={workspaceId}
        onChange={setWorkspaceId}
      />
      <IssueList host={host} workspaceId={workspaceId} query={query} />
    </>
  );
}
