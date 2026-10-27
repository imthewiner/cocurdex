import type { SavedHost } from "@cocurdex/client-runtime";
import DropDownIcon from "@expo/material-symbols/arrow_drop_down.xml";
import { Icon, Row, Text, TextButton } from "@expo/ui/jetpack-compose";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";
import { HostSwitcherSheet } from "./host-switcher-sheet";

const TITLE_PADDING = { start: 0, end: 4 };

export function HostSwitcher({
  current,
  onPair,
}: {
  current: SavedHost;
  onPair(): void;
}) {
  const { t } = useTranslation("hosts");
  const colors = useThemeColors();
  const [presented, setPresented] = useState(false);
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View>
          <BrandHost matchContents>
            <TextButton
              onClick={() => setPresented(true)}
              colors={{ contentColor: colors.foreground }}
              contentPadding={TITLE_PADDING}
            >
              <Row verticalAlignment="center">
                <Text
                  maxLines={1}
                  overflow="ellipsis"
                  style={{ fontSize: 20, fontWeight: "500" }}
                >
                  {current.name}
                </Text>
                <Icon
                  source={DropDownIcon}
                  tint={colors.mutedForeground}
                  size={24}
                  contentDescription={t("switcher.label", {
                    host: current.name,
                  })}
                />
              </Row>
            </TextButton>
          </BrandHost>
        </Stack.Toolbar.View>
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
