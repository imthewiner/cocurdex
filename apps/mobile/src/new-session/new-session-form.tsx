import type { SavedHost } from "@cocurdex/client-runtime";
import { getSessionRuntimeAxes, type ImageAttachment } from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgentIcon, RoleAvatar, useAgentRoles } from "@/agents";
import { hostConnection } from "@/connection";
import { useSavedHosts } from "@/hosts";
import { Composer, pickImages, uploadImage } from "@/session-detail";
import { runtimeSummary, useRuntimeLabels } from "@/session-runtime";
import { useHostSessions } from "@/sessions";
import { space, useGroupedColors, useThemeColors } from "@/theme";
import {
  BrandHost,
  Form,
  FormSection,
  keyboardHidden,
  useBottomKeyboardOverlap,
  ValueFormRow,
} from "@/ui";
import {
  displayedRuntime,
  draftWorkspaceId,
  workspaceChoices,
} from "./new-session-draft";
import {
  useAgents,
  useCompatibleModels,
  useNewSessionDefaults,
} from "./new-session-queries";
import { useNewSessionState } from "./new-session-store";
import { usePermissionModeLabels } from "./permission-mode-labels";
import { createSessionStarter, shownSessionPayload } from "./start-session";

function Sheet({ host }: { host: SavedHost }) {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const colors = useThemeColors();
  const grouped = useGroupedColors();
  const bottomInset = Math.max(useSafeAreaInsets().bottom - space.sm, 0);
  const keyboardOverlap = useBottomKeyboardOverlap();
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
  const role = useAgentRoles(host.hostId).data?.find(
    (entry) => entry.id === draft.roleId,
  );
  const modeLabels = usePermissionModeLabels();
  const runtimeLabels = useRuntimeLabels();
  const agentType = defaults?.agentType ?? null;
  const selectedModel = useCompatibleModels(host.hostId, agentType).data?.find(
    ({ provider, model }) =>
      defaults?.model?.providerId === provider.id &&
      defaults.model.modelId === model.modelId,
  )?.model;
  const runtime = displayedRuntime(draft, agentType, role);
  const runtimeParts = agentType
    ? runtimeSummary(
        getSessionRuntimeAxes(agentType, selectedModel, runtime),
        runtimeLabels,
      )
    : [];
  const [startSession] = useState(() =>
    createSessionStarter(hostConnection(host.hostId)),
  );
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const canStart =
    !starting &&
    workspaceId !== null &&
    defaults !== undefined &&
    host.scopes.includes("execute");
  const agentDetail = [
    role ? agent?.label : null,
    defaults?.model?.name,
    ...runtimeParts,
    defaults?.permissionMode ? modeLabels[defaults.permissionMode].label : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const start = async (prompt: string, attachments: ImageAttachment[]) => {
    if (!canStart || !workspaceId || !defaults) return false;
    setStarting(true);
    setFailed(false);
    try {
      const session = await startSession({
        payload: shownSessionPayload(
          workspaceId,
          defaults,
          role?.id ?? null,
          draft.runtime,
        ),
        prompt,
        attachments,
        fallbackTitle: role?.name ?? agent?.label ?? t("newSession.title"),
      });
      Keyboard.dismiss();
      await keyboardHidden();
      router.replace(`/session/${host.hostId}/${session.id}`);
      return true;
    } catch {
      setStarting(false);
      setFailed(true);
      return false;
    }
  };

  const open = async (
    route: "/new-session/workspace" | "/new-session/agent",
  ) => {
    Keyboard.dismiss();
    await keyboardHidden();
    router.push(route);
  };

  return (
    <View style={[styles.fill, { backgroundColor: grouped.page }]}>
      <BrandHost style={styles.fill}>
        <Form>
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
              value={role?.name ?? agent?.label ?? t("newSession.none")}
              detail={agentDetail}
              icon={
                role ? (
                  <RoleAvatar role={role} agentId={role.agentId} size={20} />
                ) : agent ? (
                  <AgentIcon agentId={agent.id} size={16} />
                ) : undefined
              }
              onPress={() => void open("/new-session/agent")}
            />
          </FormSection>
        </Form>
      </BrandHost>
      <View style={{ paddingBottom: keyboardOverlap || bottomInset }}>
        <Composer
          running={false}
          canSend={canStart}
          canEdit={!starting}
          onSend={start}
          onStop={() => undefined}
          onPickImages={pickImages}
          onUploadImage={(image) => uploadImage(host, image)}
          placeholder={t("newSession.promptPlaceholder")}
          inputTestID="new-session-prompt"
          autoFocus
        />
      </View>
    </View>
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
