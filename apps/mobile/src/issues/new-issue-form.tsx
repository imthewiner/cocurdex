import type { SavedHost } from "@cocurdex/client-runtime";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ReactElement, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type HostInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hostConnection } from "@/connection";
import { useHostSessions } from "@/sessions";
import { layout, space, useThemeColors } from "@/theme";
import {
  keyboardHidden,
  type MenuAnchor,
  ModalCloseButton,
  measureAnchor,
  SheetAction,
  useAnchoredMenu,
  useBottomKeyboardOverlap,
  useOptionSheet,
} from "@/ui";
import { IssuePriorityMark } from "./issue-priority-mark";
import { useIssueView } from "./issue-queries";
import { IssueStatusMark } from "./issue-status-mark";
import { defaultIssuePriority, defaultIssueStatus } from "./new-issue-defaults";

const NO_WORKSPACE = "";
const UNSET_VALUES: Record<IssueField, string | null> = {
  status: null,
  priority: "none",
  workspace: NO_WORKSPACE,
};

type IssueField = "workspace" | "status" | "priority";

const CHIP_FIELDS: readonly IssueField[] = ["status", "priority"];
const MENU_LIMIT = 6;

interface Choice {
  value: string;
  label: string;
}

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
  const menu = useAnchoredMenu("new-issue-menu");
  const openSheet = useOptionSheet();
  const bottomInset = useSafeAreaInsets().bottom;
  const keyboardOverlap = useBottomKeyboardOverlap();
  const titleInput = useRef<TextInputInstance>(null);
  const descriptionInput = useRef<TextInputInstance>(null);
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

  const pickInSheet = async (field: IssueField) => {
    titleInput.current?.blur();
    descriptionInput.current?.blur();
    await keyboardHidden();
    openSheet({ title: titles[field], items: choiceItems(field) });
  };

  const pick = (field: IssueField, anchor: MenuAnchor) => {
    if (choices[field].length > MENU_LIMIT) return void pickInSheet(field);
    menu.open(anchor, { title: titles[field], items: choiceItems(field) });
  };

  const choiceItems = (field: IssueField) =>
    choices[field].map((choice) => ({
      key: choice.value,
      label: choice.label,
      leading: markOf(field, choice.value, choice.label),
      selected: choice.value === values[field],
      testID: `new-issue-choice-${choice.value || "none"}`,
      onPress: () => setters[field](choice.value),
    }));

  const markOf = (field: IssueField, value: string | null, label: string) => {
    if (field === "status") {
      const option = data?.statusOptions.find((entry) => entry.id === value);
      return (
        <IssueStatusMark category={option?.category ?? null} label={label} />
      );
    }
    if (field === "priority" && value) {
      return <IssuePriorityMark priority={value} label={label} />;
    }
    return undefined;
  };

  const chipMarkOf = (field: IssueField) =>
    field === "workspace" ? (
      <SymbolView
        name={{ ios: "folder", android: "folder" }}
        size={16}
        tintColor={colors.mutedForeground}
      />
    ) : (
      markOf(field, values[field], labelOf(field))
    );

  const fieldChip = (field: IssueField) => {
    const unset = UNSET_VALUES[field] === values[field];
    return (
      <PropertyChip
        key={field}
        testID={`new-issue-${field}`}
        label={unset ? titles[field] : labelOf(field)}
        unset={unset}
        accessibilityLabel={`${titles[field]}, ${labelOf(field)}`}
        leading={chipMarkOf(field)}
        onPress={(anchor) => pick(field, anchor)}
      />
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerTitle: () => fieldChip("workspace") }} />
      <ModalCloseButton />
      <SheetAction
        label={creating ? t("create.creating") : t("create.submit")}
        disabled={!canCreate}
        onPress={() => void create()}
      />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <TextInput
          ref={titleInput}
          testID="new-issue-title"
          placeholder={t("create.titlePlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.tint}
          autoFocus
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => descriptionInput.current?.focus()}
          onChangeText={setTitle}
          style={[styles.title, { color: colors.foreground }]}
        />
        <TextInput
          ref={descriptionInput}
          testID="new-issue-description"
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
            {t("create.failed")}
          </Text>
        ) : null}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        style={styles.chipBar}
        contentContainerStyle={[
          styles.chips,
          { paddingBottom: (keyboardOverlap || bottomInset) + space.sm },
        ]}
      >
        {CHIP_FIELDS.map(fieldChip)}
      </ScrollView>
      {menu.menu}
    </View>
  );
}

function PropertyChip({
  label,
  unset,
  accessibilityLabel,
  leading,
  onPress,
  testID,
}: {
  label: string;
  unset: boolean;
  accessibilityLabel: string;
  leading?: ReactElement;
  onPress(anchor: MenuAnchor): void;
  testID: string;
}) {
  const colors = useThemeColors();
  const chip = useRef<HostInstance>(null);
  return (
    <Pressable
      ref={chip}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => measureAnchor(chip.current, onPress)}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: colors.muted },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {leading ?? null}
      <Text
        numberOfLines={1}
        style={[
          styles.chipLabel,
          { color: unset ? colors.mutedForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: layout.sideMargin, gap: space.sm },
  title: { fontSize: 22, lineHeight: 28, paddingVertical: space.xs },
  description: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: "top",
    paddingVertical: space.xs,
  },
  failed: { fontSize: 13, lineHeight: 18 },
  chipBar: { flexGrow: 0 },
  chips: {
    gap: space.sm,
    paddingHorizontal: layout.sideMargin,
    paddingTop: space.sm,
  },
  chip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    borderRadius: 18,
  },
  pressed: { opacity: 0.7 },
  chipLabel: { fontSize: 14, lineHeight: 20 },
});
