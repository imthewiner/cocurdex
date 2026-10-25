import type { SavedHost } from "@cocurdex/client-runtime";
import { Text, TextInput, type TextInputRef } from "@expo/ui";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { hostConnection } from "@/connection";
import { useSavedHosts } from "@/hosts";
import { useHostSessions } from "@/sessions";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  FieldSection,
  Form,
  FormSection,
  keyboardHidden,
  SheetAction,
  ValueFormRow,
} from "@/ui";
import { draftWorkspaceId, workspaceChoices } from "./new-session-draft";
import { useAgents, useNewSessionDefaults } from "./new-session-queries";
import { useNewSessionState } from "./new-session-store";
import { usePermissionModeLabels } from "./permission-mode-labels";
import { createSessionStarter, shownSessionPayload } from "./start-session";

function Sheet({ host }: { host: SavedHost }) {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const colors = useThemeColors();
  const promptInput = useRef<TextInputRef>(null);
  const { draft } = useNewSessionState();
  const { workspaces, sessions } = useHostSessions(host.hostId);
  const choices = workspaceChoices(workspaces, sessions);
  const workspaceId = draftWorkspaceId(draft, choices);
  const workspace = choices.find(
    (choice) => choice.workspace.id === workspaceId,
  );
  const defaults = useNewSessionDefaults(host.hostId, workspaceId, draft).data;
  const agent = useAgents(host.hostId).data?.find(
    (entry) => entry.id === defaults?.agentType,
  );
  const modeLabels = usePermissionModeLabels();
  const [prompt, setPrompt] = useState("");
  const [startSession] = useState(() =>
    createSessionStarter(hostConnection(host.hostId)),
  );
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const canStart =
    !starting &&
    prompt.trim() !== "" &&
    workspaceId !== null &&
    defaults !== undefined &&
    host.scopes.includes("execute");
  const agentDetail = [
    defaults?.model?.name,
    defaults?.permissionMode ? modeLabels[defaults.permissionMode].label : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const start = async () => {
    if (!canStart || !workspaceId || !defaults) return;
    promptInput.current?.blur();
    setStarting(true);
    setFailed(false);
    try {
      const session = await startSession({
        payload: shownSessionPayload(workspaceId, defaults),
        prompt: prompt.trim(),
        fallbackTitle: agent?.label ?? t("newSession.title"),
      });
      await keyboardHidden();
      router.replace(`/session/${host.hostId}/${session.id}`);
    } catch {
      setStarting(false);
      setFailed(true);
    }
  };

  const open = async (
    route: "/new-session/workspace" | "/new-session/agent",
  ) => {
    promptInput.current?.blur();
    await keyboardHidden();
    router.push(route);
  };

  return (
    <>
      <SheetAction
        label={starting ? t("newSession.starting") : t("newSession.start")}
        disabled={!canStart}
        onPress={() => void start()}
      />
      <BrandHost style={styles.fill}>
        <Form>
          <FieldSection>
            <TextInput
              ref={promptInput}
              testID="new-session-prompt"
              placeholder={t("newSession.promptPlaceholder")}
              multiline
              autoFocus
              onChangeText={setPrompt}
            />
          </FieldSection>
          <FormSection
            title={t("newSession.where")}
            footer={
              failed ? (
                <Text textStyle={{ color: colors.destructive }}>
                  {t("newSession.failed")}
                </Text>
              ) : (
                <Text textStyle={{ color: colors.mutedForeground }}>
                  {t("newSession.runsOn", { host: host.name })}
                </Text>
              )
            }
          >
            <ValueFormRow
              testID="new-session-workspace"
              label={t("newSession.workspace")}
              value={workspace?.workspace.name ?? t("newSession.none")}
              onPress={() => void open("/new-session/workspace")}
            />
            <ValueFormRow
              testID="new-session-agent"
              label={t("newSession.agent")}
              value={agent?.label ?? t("newSession.none")}
              detail={agentDetail}
              onPress={() => void open("/new-session/agent")}
            />
          </FormSection>
        </Form>
      </BrandHost>
    </>
  );
}

export function NewSessionForm() {
  const { hostId } = useNewSessionState();
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  return host ? <Sheet host={host} /> : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
