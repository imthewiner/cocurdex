import type { SavedHost } from "@cocurdex/client-runtime";
import { countActiveSessionFilters } from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet } from "react-native";
import { useCurrentHost } from "@/hosts";
import { useSessionListLabels, useSessionListUi } from "@/sessions";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  CloseButton,
  Form,
  FormRow,
  FormSection,
  SheetAction,
  ValueFormRow,
} from "@/ui";
import { clearSessionFilters, useFilterSummaries } from "./filter-summaries";
import type { ListOptionField } from "./list-option-fields";
import { markSessionsRead, useUnreadSessionIds } from "./mark-all-read";

function Sheet({ host }: { host: SavedHost }) {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const colors = useThemeColors();
  const labels = useSessionListLabels();
  const { view } = useSessionListUi();
  const summaries = useFilterSummaries(host.hostId, view);
  const unreadIds = useUnreadSessionIds(host.hostId);
  const filterCount = countActiveSessionFilters(view);
  const canMarkRead = unreadIds.length > 0 && host.scopes.includes("interact");
  const open = (field: ListOptionField) =>
    router.push({ pathname: "/list-options/[field]", params: { field } });
  const done = () => router.dismiss();

  return (
    <>
      {Platform.OS === "android" ? (
        <CloseButton
          accessibilityLabel={t("list.options.close")}
          onPress={done}
        />
      ) : null}
      <SheetAction
        label={t("list.options.done")}
        disabled={false}
        onPress={done}
      />
      <BrandHost style={styles.fill}>
        <Form>
          <FormSection title={t("list.options.view")}>
            <ValueFormRow
              testID="list-option-grouping"
              label={t("list.groupingLabel")}
              value={labels.grouping[view.grouping]}
              onPress={() => open("grouping")}
            />
            <ValueFormRow
              testID="list-option-ordering"
              label={t("list.orderingLabel")}
              value={`${labels.ordering[view.ordering]} · ${labels.direction[view.direction]}`}
              onPress={() => open("ordering")}
            />
            <ValueFormRow
              testID="list-option-root-limit"
              label={t("list.rootLimitLabel")}
              value={labels.rootLimit(view.rootLimit)}
              onPress={() => open("rootLimit")}
            />
          </FormSection>
          <FormSection
            title={
              filterCount > 0
                ? t("list.filtersCount", { count: filterCount })
                : t("list.filtersLabel")
            }
          >
            <ValueFormRow
              testID="list-option-statuses"
              label={t("list.statusFilter")}
              value={summaries.statuses}
              onPress={() => open("statuses")}
            />
            <ValueFormRow
              testID="list-option-agents"
              label={t("list.agentFilter")}
              value={summaries.agents}
              onPress={() => open("agents")}
            />
            <ValueFormRow
              testID="list-option-environments"
              label={t("list.environmentFilter")}
              value={summaries.environments}
              onPress={() => open("environments")}
            />
            {filterCount > 0 ? (
              <FormRow testID="list-option-clear" onPress={clearSessionFilters}>
                <Text textStyle={{ color: colors.tint }}>
                  {t("list.clearFilters")}
                </Text>
              </FormRow>
            ) : null}
          </FormSection>
          <FormSection>
            {canMarkRead ? (
              <FormRow
                testID="list-option-mark-read"
                onPress={() => {
                  void markSessionsRead(host.hostId, unreadIds);
                  done();
                }}
              >
                <Text textStyle={{ color: colors.tint }}>
                  {t("list.markAllRead")}
                </Text>
              </FormRow>
            ) : null}
            <ValueFormRow
              testID="list-option-archived"
              label={t("list.options.archived")}
              value=""
              onPress={() => {
                done();
                router.push({
                  pathname: "/archived/[hostId]",
                  params: { hostId: host.hostId },
                });
              }}
            />
          </FormSection>
        </Form>
      </BrandHost>
    </>
  );
}

export function ListOptionsSheet() {
  const host = useCurrentHost();
  return host ? <Sheet host={host} /> : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
