import type { SavedHost } from "@cocurdex/client-runtime";
import { useTranslation } from "react-i18next";
import { useHostSessions } from "@/sessions";
import { ChoiceSheet } from "@/ui";

const ALL_WORKSPACES = "";

export function useWorkspaceFilterLabel(
  hostId: string,
  workspaceId: string | null,
) {
  const { t } = useTranslation("issues");
  const { workspaces } = useHostSessions(hostId);
  const title =
    workspaces.find((workspace) => workspace.id === workspaceId)?.name ??
    t("allWorkspaces");
  return t("workspaceFilter", { workspace: title });
}

export function WorkspaceFilterSheet({
  host,
  presented,
  workspaceId,
  onChange,
  onDismiss,
}: {
  host: SavedHost;
  presented: boolean;
  workspaceId: string | null;
  onChange(workspaceId: string | null): void;
  onDismiss(): void;
}) {
  const { t } = useTranslation("issues");
  const { workspaces } = useHostSessions(host.hostId);
  const choices = [
    { value: ALL_WORKSPACES, label: t("allWorkspaces") },
    ...workspaces.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })),
  ];
  return (
    <ChoiceSheet
      testID="workspace-filter-sheet"
      title={presented ? t("field.workspace") : null}
      choices={choices}
      selected={workspaceId ?? ALL_WORKSPACES}
      onSelect={(value) => onChange(value === ALL_WORKSPACES ? null : value)}
      onDismiss={onDismiss}
    />
  );
}
