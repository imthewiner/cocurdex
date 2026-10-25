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
import { IssueList, WorkspaceFilter } from "@/issues";

export default function IssuesScreen() {
  const { t } = useTranslation("issues");
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  const router = useRouter();
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
      <Stack.Toolbar placement="right">
        <WorkspaceFilter
          host={host}
          workspaceId={workspaceId}
          onChange={setWorkspaceId}
        />
        {host.scopes.includes("interact") ? (
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "plus" : AddIcon}
            accessibilityLabel={t("create.open")}
            onPress={() =>
              router.push({
                pathname: "/new-issue/[hostId]",
                params: workspaceId
                  ? { hostId: host.hostId, workspaceId }
                  : { hostId: host.hostId },
              })
            }
          />
        ) : null}
      </Stack.Toolbar>
      <IssueList host={host} workspaceId={workspaceId} query={query} />
    </>
  );
}
