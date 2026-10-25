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
  ChoiceSheet,
  FieldSection,
  Form,
  FormSection,
  keyboardHidden,
  SheetAction,
  ValueFormRow,
} from "@/ui";
import { useNotes } from "./note-queries";

const NO_WORKSPACE = "";

export function NewNoteForm({ host }: { host: SavedHost }) {
  const { t } = useTranslation("notes");
  const router = useRouter();
  const colors = useThemeColors();
  const titleInput = useRef<TextInputRef>(null);
  const bodyInput = useRef<TextInputRef>(null);
  const notes = useNotes(host.hostId);
  const { workspaces } = useHostSessions(host.hostId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [workspaceId, setWorkspaceId] = useState(NO_WORKSPACE);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const workspaceChoices = [
    { value: NO_WORKSPACE, label: t("noWorkspace") },
    ...workspaces.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })),
  ];
  const workspaceLabel =
    workspaceChoices.find((choice) => choice.value === workspaceId)?.label ??
    t("noWorkspace");
  const canCreate =
    !creating &&
    (title.trim() !== "" || body.trim() !== "") &&
    host.scopes.includes("interact");

  const create = async () => {
    if (!canCreate) return;
    titleInput.current?.blur();
    bodyInput.current?.blur();
    setCreating(true);
    setFailed(false);
    try {
      const note = await hostConnection(host.hostId).request("note.create", {
        title: title.trim(),
        bodyMarkdown: body,
        workspaceId: workspaceId === NO_WORKSPACE ? null : workspaceId,
      });
      void notes.mutate();
      await keyboardHidden();
      router.replace({
        pathname: "/note/[hostId]/[noteId]",
        params: { hostId: host.hostId, noteId: note.id },
      });
    } catch {
      setCreating(false);
      setFailed(true);
    }
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
              testID="new-note-title"
              placeholder={t("create.titlePlaceholder")}
              autoFocus
              onChangeText={setTitle}
            />
            <TextInput
              ref={bodyInput}
              testID="new-note-body"
              placeholder={t("create.bodyPlaceholder")}
              multiline
              onChangeText={setBody}
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
              testID="new-note-workspace"
              label={t("workspace")}
              value={workspaceLabel}
              onPress={() => {
                titleInput.current?.blur();
                bodyInput.current?.blur();
                void keyboardHidden().then(() => setPicking(true));
              }}
            />
          </FormSection>
        </Form>
      </BrandHost>
      <ChoiceSheet
        title={picking ? t("workspace") : null}
        choices={workspaceChoices}
        selected={workspaceId}
        onSelect={setWorkspaceId}
        onDismiss={() => setPicking(false)}
        testID="new-note-choices"
      />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
