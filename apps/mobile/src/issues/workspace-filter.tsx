import type { SavedHost } from "@cocurdex/client-runtime";
import FolderIcon from "@expo/material-symbols/folder.xml";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useHostSessions } from "@/sessions";

export function WorkspaceFilter({
  host,
  workspaceId,
  onChange,
}: {
  host: SavedHost;
  workspaceId: string | null;
  onChange(workspaceId: string | null): void;
}) {
  const { t } = useTranslation("issues");
  const { workspaces } = useHostSessions(host.hostId);
  const current = workspaces.find((workspace) => workspace.id === workspaceId);
  const title = current?.name ?? t("allWorkspaces");
  return (
    <Stack.Toolbar.Menu
      title={title}
      icon={Platform.OS === "ios" ? "folder" : FolderIcon}
      accessibilityLabel={t("workspaceFilter", { workspace: title })}
    >
      <Stack.Toolbar.MenuAction
        isOn={workspaceId === null}
        onPress={() => onChange(null)}
      >
        {t("allWorkspaces")}
      </Stack.Toolbar.MenuAction>
      {workspaces.map((workspace) => (
        <Stack.Toolbar.MenuAction
          key={workspace.id}
          isOn={workspace.id === workspaceId}
          onPress={() => onChange(workspace.id)}
        >
          {workspace.name}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}
