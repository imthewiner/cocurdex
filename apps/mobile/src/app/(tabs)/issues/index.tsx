import type { SavedHost } from "@cocurdex/client-runtime";
import AddIcon from "@expo/material-symbols/add.xml";
import FolderIcon from "@expo/material-symbols/folder.xml";
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
import {
  IssueList,
  useWorkspaceFilterLabel,
  WorkspaceFilterSheet,
} from "@/issues";
import { useSearchBarOptions } from "@/ui";

export default function IssuesScreen() {
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  if (!host) {
    return <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />;
  }
  return <HostIssues host={host} onPair={openPaste} />;
}

function HostIssues({ host, onPair }: { host: SavedHost; onPair(): void }) {
  const { t } = useTranslation("issues");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchBarOptions = useSearchBarOptions(t("search"), setQuery);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [pickingWorkspace, setPickingWorkspace] = useState(false);
  const workspaceFilterLabel = useWorkspaceFilterLabel(
    host.hostId,
    workspaceId,
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: searchBarOptions,
        }}
      />
      <HostSwitcher current={host} onPair={onPair} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "folder" : FolderIcon}
          accessibilityLabel={workspaceFilterLabel}
          onPress={() => setPickingWorkspace(true)}
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
      <WorkspaceFilterSheet
        host={host}
        presented={pickingWorkspace}
        workspaceId={workspaceId}
        onChange={setWorkspaceId}
        onDismiss={() => setPickingWorkspace(false)}
      />
    </>
  );
}
