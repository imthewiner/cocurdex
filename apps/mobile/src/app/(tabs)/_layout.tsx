import { NativeTabs } from "expo-router/native-tabs";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useThemeColors } from "@/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <NativeTabs
      tintColor={colors.tint}
      {...(Platform.OS === "android"
        ? {
            backgroundColor: colors.background,
            disableIndicator: true,
            rippleColor: colors.muted,
            iconColor: {
              default: colors.mutedForeground,
              selected: colors.foreground,
            },
            labelStyle: {
              default: { color: colors.mutedForeground },
              selected: { color: colors.foreground },
            },
            labelVisibilityMode: "labeled" as const,
          }
        : {})}
    >
      <NativeTabs.Trigger name="(sessions)">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "bubble.left.and.bubble.right",
            selected: "bubble.left.and.bubble.right.fill",
          }}
          md="forum"
        />
        <NativeTabs.Trigger.Label>
          {t("tabs.sessions")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="issues">
        <NativeTabs.Trigger.Icon
          sf={{ default: "circle.circle", selected: "circle.circle.fill" }}
          md="adjust"
        />
        <NativeTabs.Trigger.Label>{t("tabs.issues")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Icon
          sf={{ default: "doc.text", selected: "doc.text.fill" }}
          md="description"
        />
        <NativeTabs.Trigger.Label>{t("tabs.notes")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="computers">
        <NativeTabs.Trigger.Icon sf="laptopcomputer" md="computer" />
        <NativeTabs.Trigger.Label>
          {t("tabs.computers")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
