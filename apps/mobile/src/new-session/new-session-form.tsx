import type { SavedHost } from "@cocurdex/client-runtime";
import type { ImageAttachment } from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgentIcon, RoleAvatar } from "@/agents";
import { hostConnection } from "@/connection";
import { useSavedHosts } from "@/hosts";
import { Composer, pickImages, uploadImage } from "@/session-detail";
import { space, useGroupedColors, useThemeColors } from "@/theme";
import {
  BrandHost,
  Form,
  FormSection,
  keyboardHidden,
  useBottomKeyboardOverlap,
  ValueFormRow,
} from "@/ui";
import { useNewSessionSelection } from "./new-session-selection";
import { useNewSessionState } from "./new-session-store";
import { createSessionStarter, shownSessionPayload } from "./start-session";

function Sheet({ host }: { host: SavedHost }) {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const colors = useThemeColors();
  const grouped = useGroupedColors();
  const bottomInset = Math.max(useSafeAreaInsets().bottom - space.sm, 0);
  const keyboardOverlap = useBottomKeyboardOverlap();
  const { draft, workspaceId, workspace, defaults, agent, role, agentDetail } =
    useNewSessionSelection(host);
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
