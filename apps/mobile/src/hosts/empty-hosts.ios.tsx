import { Button, ContentUnavailableView, VStack } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, tint } from "@expo/ui/swift-ui/modifiers";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { space, useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";

export function EmptyHosts({ onPair }: { onPair(): void }) {
  const { t } = useTranslation("hosts");
  const colors = useThemeColors();
  return (
    <BrandHost style={styles.fill}>
      <VStack spacing={space.lg}>
        <ContentUnavailableView
          title={t("empty.title")}
          systemImage="desktopcomputer"
          description={t("empty.description")}
        />
        <Button
          label={t("empty.pair")}
          onPress={onPair}
          modifiers={[
            buttonStyle("borderedProminent"),
            controlSize("large"),
            tint(colors.primary),
          ]}
        />
      </VStack>
    </BrandHost>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
