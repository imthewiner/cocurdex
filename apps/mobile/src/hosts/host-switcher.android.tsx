import type { SavedHost } from "@cocurdex/client-runtime";
import DropDownIcon from "@expo/material-symbols/arrow_drop_down.xml";
import { Icon, Row, Text, TextButton } from "@expo/ui/jetpack-compose";
import {
  IntrinsicSize,
  testID,
  weight,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import { useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";
import { HostSwitcherSheet } from "./host-switcher-sheet";

const TITLE_INSET = 12;
const TITLE_PADDING = { start: TITLE_INSET, end: 4 };
const TOOLBAR_INSETS = 16 + 4;
const TRAILING_ACTIONS = 3;
const ACTION_WIDTH = 48;
const ACTION_GAP = 8;

function switcherMaxWidth(windowWidth: number) {
  return (
    windowWidth - TOOLBAR_INSETS - TRAILING_ACTIONS * ACTION_WIDTH - ACTION_GAP
  );
}

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
  const windowWidth = useWindowDimensions().width;
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View>
          <BrandHost
            matchContents={{ vertical: true }}
            style={{
              width: switcherMaxWidth(windowWidth),
              transform: [{ translateX: -TITLE_INSET }],
            }}
          >
            <TextButton
              onClick={() => setPresented(true)}
              colors={{ contentColor: colors.foreground }}
              contentPadding={TITLE_PADDING}
              modifiers={[testID("host-switcher")]}
            >
              <Row
                verticalAlignment="center"
                modifiers={[width(IntrinsicSize.Max)]}
              >
                <Text
                  maxLines={1}
                  overflow="ellipsis"
                  modifiers={[weight(1)]}
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
