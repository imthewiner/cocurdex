import type { SavedHost } from "@cocurdex/client-runtime";
import RenameIcon from "@expo/material-symbols/edit.xml";
import InfoIcon from "@expo/material-symbols/info.xml";
import RemoveIcon from "@expo/material-symbols/link_off.xml";
import SwitchIcon from "@expo/material-symbols/swap_horiz.xml";
import { BottomSheet, Column, Icon, type IconName, Text } from "@expo/ui";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { hostAddress, selectHost } from "@/hosts";
import { space, useThemeColors } from "@/theme";
import { SHEET_TITLE_INSET, SheetRow } from "@/ui";
import { useUnpairHost } from "./use-unpair-host";

type ComputerAction = "switch" | "rename" | "details" | "remove";

const ACTION_ICONS: Record<ComputerAction, IconName> = {
  switch: { ios: "arrow.left.arrow.right", android: SwitchIcon },
  rename: { ios: "pencil", android: RenameIcon },
  details: { ios: "info.circle", android: InfoIcon },
  remove: { ios: "minus.circle", android: RemoveIcon },
};

function ComputerActions({
  host,
  current,
  onDismiss,
}: {
  host: SavedHost;
  current: boolean;
  onDismiss(): void;
}) {
  const { t } = useTranslation("hosts");
  const colors = useThemeColors();
  const { unpair, dialog } = useUnpairHost();
  const labels: Record<ComputerAction, string> = {
    switch: t("actions.switch"),
    rename: t("actions.rename"),
    details: t("actions.details"),
    remove: t("actions.remove"),
  };
  const handlers: Record<ComputerAction, () => void> = {
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
  const actions: ComputerAction[] = [
    ...(current ? [] : (["switch"] as const)),
    "rename",
    "details",
    "remove",
  ];
  return (
    <Column spacing={space.xs}>
      <Column spacing={2} style={{ paddingHorizontal: SHEET_TITLE_INSET }}>
        <Text
          numberOfLines={1}
          textStyle={{
            color: colors.foreground,
            fontSize: 17,
            fontWeight: "600",
          }}
        >
          {host.name}
        </Text>
        <Text
          numberOfLines={1}
          textStyle={{ color: colors.mutedForeground, fontSize: 13 }}
        >
          {hostAddress(host)}
        </Text>
      </Column>
      {actions.map((action) => {
        const color =
          action === "remove" ? colors.destructive : colors.foreground;
        return (
          <SheetRow
            key={action}
            testID={`computer-action-${action}`}
            label={labels[action]}
            color={color}
            onPress={handlers[action]}
            leading={
              <Icon name={ACTION_ICONS[action]} size={22} color={color} />
            }
          />
        );
      })}
      {dialog}
    </Column>
  );
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
  const colors = useThemeColors();
  return (
    <BottomSheet
      isPresented={host !== null}
      onDismiss={onDismiss}
      containerColor={colors.background}
      testID="computer-actions"
    >
      {host ? (
        <ComputerActions host={host} current={current} onDismiss={onDismiss} />
      ) : null}
    </BottomSheet>
  );
}
