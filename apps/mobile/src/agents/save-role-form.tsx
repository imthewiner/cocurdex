import type { SavedHost } from "@cocurdex/client-runtime";
import type { AgentRoleDraft, AgentRoleRecord } from "@cocurdex/shared";
import { Text, TextInput, type TextInputRef } from "@expo/ui";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { hostConnection } from "@/connection";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  FieldSection,
  Form,
  keyboardHidden,
  SheetAction,
} from "@/ui";
import { useAgentRoles } from "./agent-queries";

export function SaveRoleForm({
  host,
  draft,
  summary,
  onSaved,
}: {
  host: SavedHost;
  draft: AgentRoleDraft | null;
  summary: string;
  onSaved?(role: AgentRoleRecord): void;
}) {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const colors = useThemeColors();
  const roles = useAgentRoles(host.hostId);
  const nameInput = useRef<TextInputRef>(null);
  const descriptionInput = useRef<TextInputRef>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmedName = name.trim();
  const canSave =
    !saving &&
    draft !== null &&
    trimmedName !== "" &&
    host.scopes.includes("interact");

  const save = async () => {
    if (!canSave) return;
    nameInput.current?.blur();
    descriptionInput.current?.blur();
    setSaving(true);
    setFailed(false);
    try {
      const role = await hostConnection(host.hostId).request("agentRole.save", {
        ...draft,
        name: trimmedName,
        description: description.trim() || null,
      });
      void roles.mutate();
      onSaved?.(role);
      await keyboardHidden();
      router.back();
    } catch {
      setSaving(false);
      setFailed(true);
    }
  };

  return (
    <>
      <SheetAction
        label={saving ? t("saveRole.saving") : t("saveRole.save")}
        disabled={!canSave}
        onPress={() => void save()}
      />
      <BrandHost style={styles.fill}>
        <Form>
          <FieldSection
            title={t("saveRole.name")}
            footer={
              <Text textStyle={{ color: colors.mutedForeground }}>
                {summary}
              </Text>
            }
          >
            <TextInput
              ref={nameInput}
              testID="save-role-name"
              placeholder={t("saveRole.namePlaceholder")}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => descriptionInput.current?.focus()}
              onChangeText={setName}
            />
          </FieldSection>
          <FieldSection
            title={t("saveRole.description")}
            footer={
              <Text textStyle={{ color: colors.destructive }}>
                {failed ? t("saveRole.failed") : ""}
              </Text>
            }
          >
            <TextInput
              ref={descriptionInput}
              testID="save-role-description"
              placeholder={t("saveRole.descriptionPlaceholder")}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              onChangeText={setDescription}
            />
          </FieldSection>
        </Form>
      </BrandHost>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
