import type { SavedHost } from "@cocurdex/client-runtime";
import AddIcon from "@expo/material-symbols/add.xml";
import FolderIcon from "@expo/material-symbols/folder.xml";
import ViewKanbanIcon from "@expo/material-symbols/view_kanban.xml";
import ViewListIcon from "@expo/material-symbols/view_list.xml";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import {
  EmptyHosts,
  useCurrentHost,
  usePairingRoutes,
  useScopeGate,
} from "@/hosts";
import {
  IssueBoard,
  IssueList,
  setIssueLayout,
  useIssueLayout,
  useWorkspaceFilterLabel,
  WorkspaceFilterSheet,
} from "@/issues";
import { emptyListOptions, useListHeader } from "@/ui";

export default function IssuesScreen() {
  const { t } = useTranslation();
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  if (!host) {
    return (
      <>
        <Stack.Screen options={emptyListOptions(t("screens.issues"))} />
        <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />
      </>
    );
  }
  return <HostIssues host={host} />;
}

function HostIssues({ host }: { host: SavedHost }) {
  const { t } = useTranslation(["issues", "common"]);
  const router = useRouter();
  const gate = useScopeGate(host);
  const [query, setQuery] = useState("");
  const listHeader = useListHeader({
    placeholder: t("search"),
    onQuery: setQuery,
  });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [pickingWorkspace, setPickingWorkspace] = useState(false);
  const workspaceFilterLabel = useWorkspaceFilterLabel(
    host.hostId,
    workspaceId,
  );
  const issueLayout = useIssueLayout();
  const board = issueLayout === "board";
  const Issues = board ? IssueBoard : IssueList;

  return (
    <>
      <Stack.Screen options={listHeader.options} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={layoutToggleIcon(board)}
          accessibilityLabel={
            board ? t("layout.showList") : t("layout.showBoard")
          }
          onPress={() => setIssueLayout(board ? "list" : "board")}
        />
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "folder" : FolderIcon}
          accessibilityLabel={workspaceFilterLabel}
          onPress={() => setPickingWorkspace(true)}
        />
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "plus" : AddIcon}
          accessibilityLabel={t("create.open")}
          onPress={gate("interact", () =>
            router.push({
              pathname: "/new-issue/[hostId]",
              params: workspaceId
                ? { hostId: host.hostId, workspaceId }
                : { hostId: host.hostId },
            }),
          )}
        />
      </Stack.Toolbar>
      <Issues host={host} workspaceId={workspaceId} query={query} />
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

function layoutToggleIcon(board: boolean) {
  if (Platform.OS === "ios")
    return board ? "list.bullet" : "rectangle.split.3x1";
  return board ? ViewListIcon : ViewKanbanIcon;
}
