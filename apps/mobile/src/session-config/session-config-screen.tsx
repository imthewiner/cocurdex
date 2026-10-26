import type { SavedHost } from "@cocurdex/client-runtime";
import {
  type AgentPermissionMode,
  isAgentPermissionModeSupportedForModel,
  type SessionRuntimeSelection,
  sessionConfigurationOf,
} from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet } from "react-native";
import { usePermissionModeLabels } from "@/agents";
import { hostConnection } from "@/connection";
import { RuntimeSections } from "@/session-runtime";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  CloseButton,
  Form,
  FormRow,
  FormSection,
  SelectedMark,
  SheetAction,
  ValueFormRow,
} from "@/ui";
import { ConfigOptionSections } from "./config-option-sections";
import { McpSection } from "./mcp-section";
import { useSessionConfigState } from "./session-config-state";

export function SessionConfigScreen({
  host,
  sessionId,
}: {
  host: SavedHost;
  sessionId: string;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const router = useRouter();
  const done = () => router.dismiss();
  const modeLabels = usePermissionModeLabels();
  const { session, agent, models, snapshot, axes, configOptions, mcpServers } =
    useSessionConfigState(host, sessionId);
  const [failed, setFailed] = useState(false);
  const canInteract = host.scopes.includes("interact");
  const canConfigure = host.scopes.includes("execute");
  const connection = hostConnection(host.hostId);

  const attempt = async (run: () => Promise<unknown>) => {
    setFailed(false);
    try {
      await run();
    } catch {
      setFailed(true);
    }
  };

  const updateRuntime = (patch: {
    model?: { providerId: string; modelId: string };
    runtime?: SessionRuntimeSelection;
  }) =>
    attempt(() =>
      connection.request("session.updateRuntime", { sessionId, ...patch }),
    );

  const setConfigOption = (configId: string, value: boolean | string) =>
    void attempt(() =>
      connection.request("session.setConfig", { sessionId, configId, value }),
    );

  const choosePermissionMode = (permissionMode: AgentPermissionMode) => {
    if (!session) return;
    void attempt(() =>
      connection.request("session.configure", {
        ...sessionConfigurationOf(session),
        permissionMode,
      }),
    );
  };

  const permissionModes = (agent?.capabilities.permissionModes ?? []).filter(
    (mode) =>
      !session ||
      isAgentPermissionModeSupportedForModel(
        session.agentType,
        mode.id,
        snapshot?.modelId,
        snapshot?.modelName,
      ),
  );
  const selectedMode = session?.permissionMode;

  return (
    <>
      <Stack.Screen options={{ title: agent?.label ?? "" }} />
      {Platform.OS === "android" ? (
        <CloseButton
          accessibilityLabel={t("sessionConfig.close")}
          onPress={done}
        />
      ) : null}
      <SheetAction
        label={t("sessionConfig.done")}
        disabled={false}
        onPress={done}
      />
      <BrandHost style={styles.fill}>
        <Form>
          {failed ? (
            <FormSection
              footer={
                <Text
                  testID="session-config-failed"
                  textStyle={{ color: colors.destructive }}
                >
                  {t("detail.actionFailed")}
                </Text>
              }
            />
          ) : null}
          <FormSection
            title={t("newSession.model")}
            footer={
              models.length > 0 ? undefined : (
                <Text textStyle={{ color: colors.mutedForeground }}>
                  {snapshot?.modelName ?? t("newSession.agentDefaultModel")}
                </Text>
              )
            }
          >
            {models.map(({ provider, model }) => (
              <FormRow
                key={`${provider.id}/${model.modelId}`}
                testID={`session-config-model-${model.modelId}`}
                onPress={
                  canInteract
                    ? () =>
                        void updateRuntime({
                          model: {
                            providerId: provider.id,
                            modelId: model.modelId,
                          },
                        })
                    : undefined
                }
                supportingText={
                  <Text textStyle={{ color: colors.mutedForeground }}>
                    {provider.name}
                  </Text>
                }
                trailing={
                  <SelectedMark
                    selected={
                      snapshot?.providerId === provider.id &&
                      snapshot.modelId === model.modelId
                    }
                  />
                }
              >
                <Text>{model.name}</Text>
              </FormRow>
            ))}
          </FormSection>
          {axes && canInteract ? (
            <RuntimeSections
              axes={axes}
              onChange={(runtime) => void updateRuntime({ runtime })}
            />
          ) : null}
          {canInteract && configOptions.length > 0 ? (
            <ConfigOptionSections
              options={configOptions}
              onChange={setConfigOption}
            />
          ) : null}
          {permissionModes.length > 0 ? (
            <FormSection
              title={t("newSession.mode")}
              footer={
                canConfigure ? undefined : (
                  <Text textStyle={{ color: colors.mutedForeground }}>
                    {t("sessionConfig.modeNeedsExecute")}
                  </Text>
                )
              }
            >
              {permissionModes.map((mode) => (
                <FormRow
                  key={mode.id}
                  testID={`session-config-mode-${mode.id}`}
                  onPress={
                    canConfigure
                      ? () => choosePermissionMode(mode.id)
                      : undefined
                  }
                  supportingText={
                    <Text textStyle={{ color: colors.mutedForeground }}>
                      {modeLabels[mode.id].description}
                    </Text>
                  }
                  trailing={
                    <SelectedMark selected={mode.id === selectedMode} />
                  }
                >
                  <Text
                    textStyle={
                      mode.risk === "dangerous"
                        ? { color: colors.destructive }
                        : undefined
                    }
                  >
                    {modeLabels[mode.id].label}
                  </Text>
                </FormRow>
              ))}
            </FormSection>
          ) : null}
          {mcpServers ? <McpSection servers={mcpServers} /> : null}
          {canInteract && session ? (
            <FormSection>
              <ValueFormRow
                testID="session-config-save-role"
                label={t("saveRole.open")}
                value=""
                onPress={() =>
                  router.push({
                    pathname: "/session-config/[hostId]/[sessionId]/save-role",
                    params: { hostId: host.hostId, sessionId },
                  })
                }
              />
            </FormSection>
          ) : null}
        </Form>
      </BrandHost>
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
