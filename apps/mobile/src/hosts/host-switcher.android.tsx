import type { SavedHost } from "@cocurdex/client-runtime";
import AddIcon from "@expo/material-symbols/add.xml";
import DropDownIcon from "@expo/material-symbols/arrow_drop_down.xml";
import CheckIcon from "@expo/material-symbols/check.xml";
import ComputerIcon from "@expo/material-symbols/computer.xml";
import {
  Column,
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Icon,
  Row,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/theme";
import { BrandHost, headerLeading } from "@/ui";
import { hostAddress } from "./host-address";
import { selectHost, useSavedHosts } from "./hosts";

export function HostSwitcher({
  current,
  onPair,
}: {
  current: SavedHost;
  onPair(): void;
}) {
  const { t } = useTranslation("hosts");
  const colors = useThemeColors();
  const saved = useSavedHosts();
  const [expanded, setExpanded] = useState(false);
  const choose = (action: () => void) => () => {
    setExpanded(false);
    action();
  };
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.View>
        <BrandHost matchContents>
          {headerLeading(
            <DropdownMenu
              expanded={expanded}
              onDismissRequest={() => setExpanded(false)}
              color={colors.popover}
            >
              <DropdownMenu.Trigger>
                <TextButton
                  onClick={() => setExpanded(true)}
                  colors={{ contentColor: colors.foreground }}
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
              </DropdownMenu.Trigger>
              <DropdownMenu.Items>
                {saved.map((host) => (
                  <DropdownMenuItem
                    key={host.hostId}
                    onClick={choose(() => selectHost(host.hostId))}
                  >
                    <DropdownMenuItem.LeadingIcon>
                      <Icon
                        source={ComputerIcon}
                        tint={colors.mutedForeground}
                        size={24}
                      />
                    </DropdownMenuItem.LeadingIcon>
                    <DropdownMenuItem.Text>
                      <Column>
                        <Text
                          color={colors.foreground}
                          maxLines={1}
                          overflow="ellipsis"
                          style={{ fontSize: 16 }}
                        >
                          {host.name}
                        </Text>
                        <Text
                          color={colors.mutedForeground}
                          maxLines={1}
                          style={{ fontSize: 14 }}
                        >
                          {hostAddress(host)}
                        </Text>
                      </Column>
                    </DropdownMenuItem.Text>
                    {host.hostId === current.hostId ? (
                      <DropdownMenuItem.TrailingIcon>
                        <Icon source={CheckIcon} tint={colors.tint} size={24} />
                      </DropdownMenuItem.TrailingIcon>
                    ) : null}
                  </DropdownMenuItem>
                ))}
                <HorizontalDivider color={colors.border} />
                <DropdownMenuItem onClick={choose(onPair)}>
                  <DropdownMenuItem.LeadingIcon>
                    <Icon
                      source={AddIcon}
                      tint={colors.mutedForeground}
                      size={24}
                    />
                  </DropdownMenuItem.LeadingIcon>
                  <DropdownMenuItem.Text>
                    <Text color={colors.foreground} style={{ fontSize: 16 }}>
                      {t("empty.pair")}
                    </Text>
                  </DropdownMenuItem.Text>
                </DropdownMenuItem>
              </DropdownMenu.Items>
            </DropdownMenu>,
          )}
        </BrandHost>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
