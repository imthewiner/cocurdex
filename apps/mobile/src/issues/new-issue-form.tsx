import type { SavedHost } from "@cocurdex/client-runtime";
import { Text, TextInput, type TextInputRef } from "@expo/ui";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { hostConnection } from "@/connection";
import { useHostSessions } from "@/sessions";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  type Choice,
  ChoiceSheet,
  FieldSection,
  Form,
  FormSection,
  keyboardHidden,
  SheetAction,
  ValueFormRow,
} from "@/ui";
import { useIssueView } from "./issue-queries";
import { defaultIssuePriority, defaultIssueStatus } from "./new-issue-defaults";

const NO_WORKSPACE = "";

type IssueField = "workspace" | "status" | "priority";

export function NewIssueForm({
  host,
  initialWorkspaceId,
}: {
  host: SavedHost;
  initialWorkspaceId: string | null;
}) {
  const { t } = useTranslation("issues");
  const router = useRouter();
  const colors = useThemeColors();
  const titleInput = useRef<TextInputRef>(null);
  const descriptionInput = useRef<TextInputRef>(null);
  const view = useIssueView(host.hostId);
  const { workspaces } = useHostSessions(host.hostId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState(
    initialWorkspaceId ?? NO_WORKSPACE,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState<IssueField | null>(null);
  const data = view.data;
  const statusId = status ?? defaultIssueStatus(data?.statusOptions ?? []);
  const priorityId =
    priority ?? defaultIssuePriority(data?.priorityOptions ?? []);
  const canCreate =
    !creating &&
    title.trim() !== "" &&
    data != null &&
    host.scopes.includes("interact");

  const create = async () => {
    if (!canCreate || !data) return;
    titleInput.current?.blur();
    descriptionInput.current?.blur();
    setCreating(true);
    setFailed(false);
    try {
      const issue = await hostConnection(host.hostId).request("issue.create", {
        viewId: data.view.id,
        title: title.trim(),
        description: description.trim() || null,
        status: statusId,
        priority: priorityId,
        workspaceId: workspaceId === NO_WORKSPACE ? null : workspaceId,
      });
      void view.mutate();
      await keyboardHidden();
      router.replace({
        pathname: "/issue/[hostId]/[issueId]",
        params: { hostId: host.hostId, issueId: issue.id },
      });
    } catch {
      setCreating(false);
      setFailed(true);
    }
  };

  const choices: Record<IssueField, Choice[]> = {
    workspace: [
      { value: NO_WORKSPACE, label: t("field.none") },
      ...workspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.name,
      })),
    ],
    status: (data?.statusOptions ?? []).map((option) => ({
      value: option.id,
      label: option.title,
    })),
    priority: (data?.priorityOptions ?? []).map((option) => ({
      value: option.id,
      label: option.title,
    })),
  };
  const values: Record<IssueField, string | null> = {
    workspace: workspaceId,
    status: statusId ?? null,
    priority: priorityId ?? null,
  };
  const setters: Record<IssueField, (value: string) => void> = {
    workspace: setWorkspaceId,
    status: setStatus,
    priority: setPriority,
  };
  const titles: Record<IssueField, string> = {
    workspace: t("field.workspace"),
    status: t("field.status"),
    priority: t("field.priority"),
  };
  const labelOf = (field: IssueField) =>
    choices[field].find((choice) => choice.value === values[field])?.label ??
    t("field.none");

  const pick = async (field: IssueField) => {
    titleInput.current?.blur();
    descriptionInput.current?.blur();
    await keyboardHidden();
    setPicking(field);
  };

  return (
    <>
      <SheetAction
        label={creating ? t("create.creating") : t("create.submit")}
        disabled={!canCreate}
        onPress={() => void create()}
      />
      <BrandHost style={styles.fill}>
        <Form>
          <FieldSection>
            <TextInput
              ref={titleInput}
              testID="new-issue-title"
              placeholder={t("create.titlePlaceholder")}
              autoFocus
              onChangeText={setTitle}
            />
            <TextInput
              ref={descriptionInput}
              testID="new-issue-description"
              placeholder={t("create.descriptionPlaceholder")}
              multiline
              onChangeText={setDescription}
            />
          </FieldSection>
          <FormSection
            footer={
              failed ? (
                <Text textStyle={{ color: colors.destructive }}>
                  {t("create.failed")}
                </Text>
              ) : (
                <Text textStyle={{ color: colors.mutedForeground }}>
                  {t("create.hint")}
                </Text>
              )
            }
          >
            <ValueFormRow
              testID="new-issue-workspace"
              label={t("field.workspace")}
              value={labelOf("workspace")}
              onPress={() => void pick("workspace")}
            />
            <ValueFormRow
              testID="new-issue-status"
              label={t("field.status")}
              value={labelOf("status")}
              onPress={() => void pick("status")}
            />
            <ValueFormRow
              testID="new-issue-priority"
              label={t("field.priority")}
              value={labelOf("priority")}
              onPress={() => void pick("priority")}
            />
          </FormSection>
        </Form>
      </BrandHost>
      <ChoiceSheet
        title={picking ? titles[picking] : null}
        choices={picking ? choices[picking] : []}
        selected={picking ? values[picking] : null}
        onSelect={(value) => {
          if (picking) setters[picking](value);
        }}
        onDismiss={() => setPicking(null)}
        testID="new-issue-choices"
      />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
