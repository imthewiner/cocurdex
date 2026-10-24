import { Button, Column, Text } from "@expo/ui";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { space, useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";

export function EmptyHosts({ onPair }: { onPair(): void }) {
  const { t } = useTranslation("hosts");
  const colors = useThemeColors();
  return (
    <View style={styles.center}>
      <BrandHost matchContents={{ vertical: true }}>
        <Column alignment="center" spacing={space.md}>
          <Text textStyle={{ fontWeight: "600" }}>{t("empty.title")}</Text>
          <Text
            textStyle={{ color: colors.mutedForeground, textAlign: "center" }}
          >
            {t("empty.description")}
          </Text>
          <Button label={t("empty.pair")} onPress={onPair} />
        </Column>
      </BrandHost>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", paddingHorizontal: space.lg },
});
