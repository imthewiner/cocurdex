import type { SavedHost } from "@cocurdex/client-runtime";
import type { IssueSummary } from "@cocurdex/shared";
import { RNHostView, Text as UiText } from "@expo/ui";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { MarkdownText } from "@/markdown";
import { space, useThemeColors } from "@/theme";
import {
  BrandHost,
  Form,
  FormRow,
  FormSection,
  HostedAccessory,
  ListNotice,
} from "@/ui";
import { useIssueDetail, useIssueView } from "./issue-queries";
import { IssueStatusMark } from "./issue-status-mark";

function SubIssueRow({
  issue,
  onPress,
}: {
  issue: IssueSummary;
  onPress(): void;
}) {
  return (
    <FormRow
      testID={`issue-child-${issue.id}`}
      onPress={onPress}
      leading={
        <HostedAccessory>
          <IssueStatusMark
            category={issue.statusCategory}
            label={issue.status}
          />
        </HostedAccessory>
      }
      supportingText={issue.identifier}
    >
      <UiText>{issue.title}</UiText>
    </FormRow>
  );
}

export function IssueScreen({
  host,
  issueId,
}: {
  host: SavedHost;
  issueId: string;
}) {
  const { t } = useTranslation("issues");
  const router = useRouter();
  const colors = useThemeColors();
  const detail = useIssueDetail(host.hostId, issueId);
  const view = useIssueView(host.hostId).data;

  if (detail.data === undefined) {
    if (!detail.error) return <View style={styles.fill} />;
    return (
      <ListNotice
        title={t("unavailable.title", { host: host.name })}
        action={{
          label: t("unavailable.retry"),
          onPress: () => void detail.mutate(),
        }}
      />
    );
  }
  if (detail.data === null) return <ListNotice title={t("missing")} />;

  const { issue, children, sessions } = detail.data;
  const status = view?.statusOptions.find((entry) => entry.id === issue.status);
  const priority = view?.priorityOptions.find(
    (entry) => entry.id === issue.priority,
  );
  const labels = issue.labelIds.flatMap(
    (id) => view?.labels.find((label) => label.id === id)?.name ?? [],
  );
  const doneChildren = children.filter(
    (child) => child.statusCategory === "completed",
  ).length;
  const description = issue.description?.trim() ?? "";
  const muted = { color: colors.mutedForeground };

  return (
    <>
      <Stack.Screen options={{ title: issue.identifier }} />
      <BrandHost style={styles.fill}>
        <Form>
          <FormSection
            header={
              <RNHostView matchContents={{ vertical: true }}>
                <View style={styles.header}>
                  <Text
                    accessibilityRole="header"
                    selectable
                    style={[styles.title, { color: colors.foreground }]}
                  >
                    {issue.title}
                  </Text>
                  {description ? (
                    <MarkdownText
                      markdown={description}
                      testID="issue-description"
                    />
                  ) : null}
                </View>
              </RNHostView>
            }
          >
            <FormRow
              leading={
                <HostedAccessory>
                  <IssueStatusMark
                    category={issue.statusCategory}
                    label={status?.title ?? issue.status}
                  />
                </HostedAccessory>
              }
              trailing={
                <UiText textStyle={muted}>
                  {status?.title ?? issue.status}
                </UiText>
              }
            >
              <UiText>{t("field.status")}</UiText>
            </FormRow>
            <FormRow
              trailing={
                <UiText textStyle={muted}>
                  {priority?.title ?? issue.priority}
                </UiText>
              }
            >
              <UiText>{t("field.priority")}</UiText>
            </FormRow>
            <FormRow
              trailing={
                <UiText textStyle={muted}>
                  {labels.length > 0 ? labels.join(", ") : t("field.none")}
                </UiText>
              }
            >
              <UiText>{t("field.labels")}</UiText>
            </FormRow>
          </FormSection>
          {sessions.length > 0 ? (
            <FormSection title={t("sessions")}>
              {sessions.map((session) => (
                <FormRow
                  key={session.sessionId}
                  testID={`issue-session-${session.sessionId}`}
                  onPress={() =>
                    router.push({
                      pathname: "/session/[hostId]/[sessionId]",
                      params: {
                        hostId: host.hostId,
                        sessionId: session.sessionId,
                      },
                    })
                  }
                >
                  <UiText>{session.title ?? t("untitledSession")}</UiText>
                </FormRow>
              ))}
            </FormSection>
          ) : null}
          {children.length > 0 ? (
            <FormSection
              title={t("subIssues", {
                done: doneChildren,
                total: children.length,
              })}
            >
              {children.map((child) => (
                <SubIssueRow
                  key={child.id}
                  issue={child}
                  onPress={() =>
                    router.push({
                      pathname: "/issue/[hostId]/[issueId]",
                      params: { hostId: host.hostId, issueId: child.id },
                    })
                  }
                />
              ))}
            </FormSection>
          ) : null}
        </Form>
      </BrandHost>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingBottom: space.sm, gap: space.sm },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
});
