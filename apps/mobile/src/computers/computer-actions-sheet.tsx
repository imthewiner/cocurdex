import type { SavedHost } from "@cocurdex/client-runtime";
import RenameIcon from "@expo/material-symbols/edit.xml";
import InfoIcon from "@expo/material-symbols/info.xml";
import RemoveIcon from "@expo/material-symbols/link_off.xml";
import SwitchIcon from "@expo/material-symbols/swap_horiz.xml";
import type { IconName } from "@expo/ui";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { hostAddress, selectHost } from "@/hosts";
import { ListSheet } from "@/ui";
import { useUnpairHost } from "./use-unpair-host";

type ComputerAction = "switch" | "rename" | "details" | "remove";

const ACTION_ICONS: Record<ComputerAction, IconName> = {
  switch: { ios: "arrow.left.arrow.right", android: SwitchIcon },
  rename: { ios: "pencil", android: RenameIcon },
  details: { ios: "info.circle", android: InfoIcon },
  remove: { ios: "minus.circle", android: RemoveIcon },
};

function computerHandlers(
  router: ReturnType<typeof useRouter>,
  host: SavedHost,
  onDismiss: () => void,
  unpair: (host: SavedHost, onDone: () => void) => void,
): Record<ComputerAction, () => void> {
  return {
    switch: () => {
      selectHost(host.hostId);
      onDismiss();
    },
    rename: () => {
      onDismiss();
      router.push({
        pathname: "/rename-computer/[hostId]",
        params: { hostId: host.hostId },
      });
    },
    details: () => {
      onDismiss();
      router.push({
        pathname: "/computer/[hostId]",
        params: { hostId: host.hostId },
      });
    },
    remove: () => unpair(host, onDismiss),
  };
}

export function ComputerActionsSheet({
  host,
  current,
  onDismiss,
}: {
  host: SavedHost | null;
  current: boolean;
  onDismiss(): void;
}) {
  const router = useRouter();
  const { t } = useTranslation("hosts");
  const { unpair, dialog } = useUnpairHost();
  const labels: Record<ComputerAction, string> = {
    switch: t("actions.switch"),
    rename: t("actions.rename"),
    details: t("actions.details"),
    remove: t("actions.remove"),
  };
  const handlers = host
    ? computerHandlers(router, host, onDismiss, unpair)
    : null;
  const actions: ComputerAction[] = [
    ...(current ? [] : (["switch"] as const)),
    "rename",
    "details",
    "remove",
  ];
  return (
    <ListSheet
      presented={host !== null}
      title={host?.name ?? ""}
      subtitle={host ? hostAddress(host) : null}
      items={actions.map((action) => ({
        key: action,
        testID: `computer-action-${action}`,
        label: labels[action],
        icon: ACTION_ICONS[action],
        destructive: action === "remove",
        onPress: () => handlers?.[action](),
      }))}
      footer={dialog}
      onDismiss={onDismiss}
      testID="computer-actions"
    />
  );
}
