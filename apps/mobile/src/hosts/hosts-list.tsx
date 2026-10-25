import type { SavedHost } from "@cocurdex/client-runtime";
import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import { ListSeparator } from "@/ui";
import { useCurrentHost, useSavedHosts } from "./hosts";

function HostRow({ host, current }: { host: SavedHost; current: boolean }) {
  const { t } = useTranslation("hosts");
  const colors = useThemeColors();
  const address = new URL(host.baseUrl).host;
  return (
    <View
      accessible
      accessibilityLabel={host.name}
      accessibilityValue={{
        text: current ? `${address}, ${t("list.current")}` : address,
      }}
      style={styles.row}
      testID={`host-row-${host.hostId}`}
    >
      <View style={[styles.tile, { backgroundColor: colors.muted }]}>
        <SymbolView
          name={{ ios: "laptopcomputer", android: "computer" }}
          size={18}
          tintColor={colors.foreground}
        />
      </View>
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.foreground }]}
        >
          {host.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.detail, { color: colors.mutedForeground }]}
        >
          {current ? `${address} · ${t("list.current")}` : address}
        </Text>
      </View>
    </View>
  );
}

export function HostsList() {
  const saved = useSavedHosts();
  const current = useCurrentHost();
  return (
    <FlatList
      style={styles.fill}
      contentInsetAdjustmentBehavior="automatic"
      data={saved}
      keyExtractor={(host) => host.hostId}
      renderItem={({ item }) => (
        <HostRow host={item} current={item.hostId === current?.hostId} />
      )}
      ItemSeparatorComponent={ListSeparator}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: layout.sideMargin,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "500" },
  detail: { fontSize: 15, lineHeight: 20 },
});
