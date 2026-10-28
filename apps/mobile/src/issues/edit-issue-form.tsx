import type { SavedHost } from "@cocurdex/client-runtime";
import type { IssueRecord } from "@cocurdex/shared";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, space, useThemeColors } from "@/theme";
import {
  keyboardHidden,
  ModalCloseButton,
  PendingIndicator,
  SheetAction,
  useBottomKeyboardOverlap,
} from "@/ui";
import { issueTextPatch } from "./issue-patch";
import { useIssueDetail } from "./issue-queries";
import { useIssueUpdate } from "./issue-update";

export function EditIssueForm({
  host,
  issueId,
}: {
  host: SavedHost;
  issueId: string;
}) {
  const issue = useIssueDetail(host.hostId, issueId).data?.issue;
  if (!issue) return <PendingIndicator />;
  return <Editor host={host} issue={issue} />;
}

function Editor({ host, issue }: { host: SavedHost; issue: IssueRecord }) {
  const { t } = useTranslation("issues");
  const router = useRouter();
  const colors = useThemeColors();
  const update = useIssueUpdate(host, issue.id);
  const bottomInset = useSafeAreaInsets().bottom;
  const keyboardOverlap = useBottomKeyboardOverlap();
  const titleInput = useRef<TextInputInstance>(null);
  const descriptionInput = useRef<TextInputInstance>(null);
  const [revision] = useState(issue.revision);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const patch = issueTextPatch(issue, title, description);
  const canSave =
    !saving &&
    title.trim() !== "" &&
    Object.keys(patch).length > 0 &&
    host.scopes.includes("interact");

  const save = async () => {
    if (!canSave) return;
    titleInput.current?.blur();
    descriptionInput.current?.blur();
    setSaving(true);
    setFailed(false);
    try {
      await update(patch, revision);
      await keyboardHidden();
      router.back();
    } catch {
      setSaving(false);
      setFailed(true);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ModalCloseButton />
      <SheetAction
        label={saving ? t("edit.saving") : t("edit.save")}
        disabled={!canSave}
        onPress={() => void save()}
      />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (keyboardOverlap || bottomInset) + space.md },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <TextInput
          ref={titleInput}
          testID="edit-issue-title"
          value={title}
          placeholder={t("create.titlePlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.tint}
          multiline
          scrollEnabled={false}
          submitBehavior="submit"
          returnKeyType="next"
          onSubmitEditing={() => descriptionInput.current?.focus()}
          onChangeText={setTitle}
          style={[styles.title, { color: colors.foreground }]}
        />
        <TextInput
          ref={descriptionInput}
          testID="edit-issue-description"
          value={description}
          placeholder={t("create.descriptionPlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.tint}
          multiline
          scrollEnabled={false}
          onChangeText={setDescription}
          style={[styles.description, { color: colors.foreground }]}
        />
        {failed ? (
          <Text style={[styles.failed, { color: colors.destructive }]}>
            {t("edit.failed")}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: layout.sideMargin, gap: space.sm },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    paddingVertical: space.xs,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 160,
    textAlignVertical: "top",
    paddingVertical: space.xs,
  },
  failed: { fontSize: 13, lineHeight: 18 },
});
