import type { SavedHost } from "@cocurdex/client-runtime";
import AddIcon from "@expo/material-symbols/add.xml";
import ComputerIcon from "@expo/material-symbols/computer.xml";
import { useTranslation } from "react-i18next";
import { ListSheet, type ListSheetItem } from "@/ui";
import { hostAddress } from "./host-address";
import { selectHost, useSavedHosts } from "./hosts";

export function HostSwitcherSheet({
  current,
  presented,
  onPair,
  onDismiss,
}: {
  current: SavedHost;
  presented: boolean;
  onPair(): void;
  onDismiss(): void;
}) {
  const { t } = useTranslation("hosts");
  const saved = useSavedHosts();
  const choose = (action: () => void) => () => {
    onDismiss();
    action();
  };
  const items: ListSheetItem[] = [
    ...saved.map((host) => ({
      key: host.hostId,
      testID: `host-switcher-${host.hostId}`,
      label: host.name,
      supporting: hostAddress(host),
      icon: { ios: "laptopcomputer", android: ComputerIcon } as const,
      selected: host.hostId === current.hostId,
      onPress: choose(() => selectHost(host.hostId)),
    })),
    {
      key: "pair",
      testID: "host-switcher-pair",
      label: t("empty.pair"),
      icon: { ios: "plus", android: AddIcon },
      onPress: choose(onPair),
    },
  ];
  return (
    <ListSheet
      presented={presented}
      title={t("switcher.title")}
      items={items}
      onDismiss={onDismiss}
      testID="host-switcher"
    />
  );
}
