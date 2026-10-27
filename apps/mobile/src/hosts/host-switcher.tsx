import type { SavedHost } from "@cocurdex/client-runtime";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { headerLeading } from "@/ui";
import { HostSwitcherSheet } from "./host-switcher-sheet";

export function HostSwitcher({
  current,
  onPair,
}: {
  current: SavedHost;
  onPair(): void;
}) {
  const { t } = useTranslation("hosts");
  const [presented, setPresented] = useState(false);
  return (
    <>
      <Stack.Toolbar placement="left">
        {headerLeading(
          <Stack.Toolbar.Button
            icon="laptopcomputer"
            accessibilityLabel={t("switcher.label", { host: current.name })}
            onPress={() => setPresented(true)}
          >
            {current.name}
          </Stack.Toolbar.Button>,
        )}
      </Stack.Toolbar>
      <HostSwitcherSheet
        current={current}
        presented={presented}
        onPair={onPair}
        onDismiss={() => setPresented(false)}
      />
    </>
  );
}
