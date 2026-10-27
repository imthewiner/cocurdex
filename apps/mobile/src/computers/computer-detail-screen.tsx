import type { SavedHost } from "@cocurdex/client-runtime";
import type { HostAccessScope } from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import {
  hostAddress,
  selectHost,
  useCurrentHost,
  useSavedHosts,
} from "@/hosts";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  Form,
  FormRow,
  FormSection,
  SelectedMark,
  ValueFormRow,
} from "@/ui";
import { useUnpairHost } from "./use-unpair-host";

const SHOWN_SCOPES = [
  "read",
  "interact",
  "approvals",
  "execute",
  "files.read",
  "files.write",
  "git.destructive",
] as const satisfies readonly HostAccessScope[];

type ShownScope = (typeof SHOWN_SCOPES)[number];

function useScopeLabels() {
  const { t } = useTranslation("hosts");
  const labels: Record<ShownScope, { title: string; detail: string }> = {
    read: { title: t("scope.read"), detail: t("scopeDetail.read") },
    interact: { title: t("scope.interact"), detail: t("scopeDetail.interact") },
    approvals: {
      title: t("scope.approvals"),
      detail: t("scopeDetail.approvals"),
    },
    execute: { title: t("scope.execute"), detail: t("scopeDetail.execute") },
    "files.read": {
      title: t("scope.filesRead"),
      detail: t("scopeDetail.filesRead"),
    },
    "files.write": {
      title: t("scope.filesWrite"),
      detail: t("scopeDetail.filesWrite"),
    },
    "git.destructive": {
      title: t("scope.gitDestructive"),
      detail: t("scopeDetail.gitDestructive"),
    },
  };
  return labels;
}

function Detail({ host, current }: { host: SavedHost; current: boolean }) {
  const { t, i18n } = useTranslation("hosts");
  const colors = useThemeColors();
  const scopeLabels = useScopeLabels();
  const { unpair, dialog } = useUnpairHost();
  const pairedAt = new Date(host.pairedAt).toLocaleString(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const muted = (text: string) => (
    <Text textStyle={{ color: colors.mutedForeground }}>{text}</Text>
  );
  return (
    <>
      <Stack.Screen options={{ title: host.name }} />
      <BrandHost style={styles.fill}>
        <Form>
          <FormSection>
            <ValueFormRow
              testID="computer-rename"
              label={t("detail.name")}
              value={host.name}
              onPress={() =>
                router.push({
                  pathname: "/rename-computer/[hostId]",
                  params: { hostId: host.hostId },
                })
              }
            />
            <FormRow trailing={muted(hostAddress(host))}>
              <Text>{t("detail.address")}</Text>
            </FormRow>
            <FormRow trailing={muted(pairedAt)}>
              <Text>{t("detail.pairedAt")}</Text>
            </FormRow>
          </FormSection>
          <FormSection
            title={t("detail.scopes")}
            footer={muted(t("detail.scopesFooter"))}
          >
            {SHOWN_SCOPES.map((scope) => (
              <FormRow
                key={scope}
                testID={`computer-scope-${scope}`}
                supportingText={muted(scopeLabels[scope].detail)}
                trailing={
                  <SelectedMark selected={host.scopes.includes(scope)} />
                }
              >
                <Text>{scopeLabels[scope].title}</Text>
              </FormRow>
            ))}
          </FormSection>
          <FormSection>
            {current ? null : (
              <FormRow
                testID="computer-switch"
                onPress={() => {
                  selectHost(host.hostId);
                  router.back();
                }}
              >
                <Text textStyle={{ color: colors.tint }}>
                  {t("actions.switch")}
                </Text>
              </FormRow>
            )}
            <FormRow
              testID="computer-remove"
              onPress={() => unpair(host, () => router.back())}
            >
              <Text textStyle={{ color: colors.destructive }}>
                {t("actions.remove")}
              </Text>
            </FormRow>
          </FormSection>
        </Form>
        {dialog}
      </BrandHost>
    </>
  );
}

export function ComputerDetailScreen({ hostId }: { hostId: string }) {
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  const current = useCurrentHost();
  return host ? (
    <Detail host={host} current={host.hostId === current?.hostId} />
  ) : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
