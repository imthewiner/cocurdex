import { type SupportedLocale, supportedLocales } from "@cocurdex/shared";
import { Text } from "@expo/ui";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCurrentHost } from "@/hosts";
import {
  APPEARANCE_PREFERENCES,
  type AppearancePreference,
  type LanguagePreference,
  setAppearance,
  setLanguage,
  usePreferences,
} from "@/preferences";
import {
  archivedSessionRows,
  useArchivedSessions,
  useHostSessions,
} from "@/sessions";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  Form,
  FormRow,
  FormSection,
  SelectedMark,
  ValueFormRow,
} from "@/ui";

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  "en-US": "English",
  "zh-CN": "简体中文",
};

function useAppearanceLabels(): Record<AppearancePreference, string> {
  const { t } = useTranslation("settings");
  return {
    system: t("appearance.system"),
    light: t("appearance.light"),
    dark: t("appearance.dark"),
  };
}

function ArchivedRow({ hostId }: { hostId: string }) {
  const router = useRouter();
  const { t } = useTranslation("settings");
  const { workspaces } = useHostSessions(hostId);
  const { data } = useArchivedSessions(hostId);
  const count = data ? archivedSessionRows(data, workspaces).length : null;
  return (
    <ValueFormRow
      testID="settings-archived"
      label={t("sessions.archived")}
      value={count === null ? "" : String(count)}
      onPress={() =>
        router.push({ pathname: "/archived/[hostId]", params: { hostId } })
      }
    />
  );
}

function ValueText({ value }: { value: string }) {
  const colors = useThemeColors();
  return <Text textStyle={{ color: colors.mutedForeground }}>{value}</Text>;
}

export function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation("settings");
  const preferences = usePreferences();
  const appearanceLabels = useAppearanceLabels();
  const host = useCurrentHost();
  const languages: LanguagePreference[] = ["system", ...supportedLocales];
  return (
    <BrandHost style={{ flex: 1 }}>
      <Form>
        <FormSection>
          <ValueFormRow
            testID="settings-computers"
            label={t("computers")}
            value={host?.name ?? ""}
            onPress={() => router.push("/computers")}
          />
        </FormSection>
        <FormSection title={t("appearance.title")}>
          {APPEARANCE_PREFERENCES.map((appearance) => (
            <FormRow
              key={appearance}
              testID={`settings-appearance-${appearance}`}
              onPress={() => setAppearance(appearance)}
              trailing={
                <SelectedMark
                  selected={preferences.appearance === appearance}
                />
              }
            >
              <Text>{appearanceLabels[appearance]}</Text>
            </FormRow>
          ))}
        </FormSection>
        <FormSection title={t("language.title")}>
          {languages.map((language) => (
            <FormRow
              key={language}
              testID={`settings-language-${language}`}
              onPress={() => setLanguage(language)}
              trailing={
                <SelectedMark selected={preferences.language === language} />
              }
            >
              <Text>
                {language === "system"
                  ? t("language.system")
                  : LOCALE_NAMES[language]}
              </Text>
            </FormRow>
          ))}
        </FormSection>
        {host ? (
          <FormSection title={t("sessions.title")}>
            <ArchivedRow hostId={host.hostId} />
          </FormSection>
        ) : null}
        <FormSection title={t("about.title")}>
          <FormRow
            trailing={<ValueText value={Constants.expoConfig?.version ?? ""} />}
          >
            <Text>{t("about.version")}</Text>
          </FormRow>
        </FormSection>
      </Form>
    </BrandHost>
  );
}
