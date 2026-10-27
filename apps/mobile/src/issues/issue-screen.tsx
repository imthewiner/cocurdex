import type { SavedHost } from "@cocurdex/client-runtime";
import type { EntityLink, IssueSummary } from "@cocurdex/shared";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { LinkedEntitiesSection } from "@/entity-links";
import { MarkdownText } from "@/markdown";
import { space, useThemeColors } from "@/theme";
import {
  Form,
  FormRow,
  FormSection,
  FormText,
  ListNotice,
  PendingIndicator,
  useTransitionSettled,
} from "@/ui";
import { useIssueDetail, useIssueView } from "./issue-queries";
import { IssueStatusMark } from "./issue-status-mark";

function isShownAsIssueStructure(link: EntityLink) {
  if (link.removable) return false;
  return link.relation === "child" || link.relation === "worked-on-by";
}

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
        <IssueStatusMark category={issue.statusCategory} label={issue.status} />
      }
      supporting={issue.identifier}
    >
      {issue.title}
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
  const view = useIssueView(host.hostId, { cached: true }).data;
  const issue =
    detail.data?.issue ?? view?.issues.find((entry) => entry.id === issueId);
  const settled = useTransitionSettled();

  if (!settled) return <PendingIndicator />;

  if (detail.data === null) return <ListNotice title={t("missing")} />;
  if (!issue) {
    if (!detail.error) return <PendingIndicator />;
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

  const children = detail.data?.children ?? [];
  const sessions = detail.data?.sessions ?? [];
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

  return (
    <>
      <Stack.Screen options={{ title: issue.identifier }} />
      <Form>
        <FormSection
          header={
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
                  hostId={host.hostId}
                  testID="issue-description"
                />
              ) : null}
            </View>
          }
        >
          <FormRow
            leading={
              <IssueStatusMark
                category={issue.statusCategory}
                label={status?.title ?? issue.status}
              />
            }
            trailing={
              <FormText tone="muted">{status?.title ?? issue.status}</FormText>
            }
          >
            {t("field.status")}
          </FormRow>
          <FormRow
            trailing={
              <FormText tone="muted">
                {priority?.title ?? issue.priority}
              </FormText>
            }
          >
            {t("field.priority")}
          </FormRow>
          <FormRow
            trailing={
              <FormText tone="muted">
                {labels.length > 0 ? labels.join(", ") : t("field.none")}
              </FormText>
            }
          >
            {t("field.labels")}
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
                {session.title ?? t("untitledSession")}
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
        <LinkedEntitiesSection
          hostId={host.hostId}
          entity={{ kind: "issue", id: issue.id }}
          hideLink={isShownAsIssueStructure}
        />
      </Form>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space.sm, gap: space.sm },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "600" },
});
