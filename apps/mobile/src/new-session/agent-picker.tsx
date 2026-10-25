import type { SavedHost } from "@cocurdex/client-runtime";
import type { AgentAvailability, AgentDescriptor } from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { useSavedHosts } from "@/hosts";
import { useHostSessions } from "@/sessions";
import { useThemeColors } from "@/theme";
import { BrandHost, Form, FormRow, FormSection } from "@/ui";
import {
  chooseAgent,
  chooseModel,
  choosePermissionMode,
  draftWorkspaceId,
  workspaceChoices,
} from "./new-session-draft";
import {
  useAgents,
  useCompatibleModels,
  useNewSessionDefaults,
} from "./new-session-queries";
import { updateNewSessionDraft, useNewSessionState } from "./new-session-store";
import { usePermissionModeLabels } from "./permission-mode-labels";
import { SelectedMark } from "./row-accessory";

function useAvailabilityLabels(): Record<AgentAvailability, string> {
  const { t } = useTranslation("sessions");
  return {
    available: t("newSession.availability.available"),
    missing: t("newSession.availability.missing"),
    unsupported: t("newSession.availability.unsupported"),
    error: t("newSession.availability.error"),
  };
}

function AgentRow({
  agent,
  selected,
}: {
  agent: AgentDescriptor;
  selected: boolean;
}) {
  const colors = useThemeColors();
  const availability = useAvailabilityLabels();
  const available = agent.availability === "available";
  return (
    <FormRow
      onPress={
        available
          ? () => updateNewSessionDraft((draft) => chooseAgent(draft, agent.id))
          : undefined
      }
      supportingText={
        <Text textStyle={{ color: colors.mutedForeground }}>
          {availability[agent.availability]}
        </Text>
      }
      trailing={<SelectedMark selected={selected} />}
    >
      <Text
        textStyle={available ? undefined : { color: colors.mutedForeground }}
      >
        {agent.label}
      </Text>
    </FormRow>
  );
}

function Picker({ host }: { host: SavedHost }) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const modeLabels = usePermissionModeLabels();
  const { draft } = useNewSessionState();
  const { workspaces, sessions } = useHostSessions(host.hostId);
  const workspaceId = draftWorkspaceId(
    draft,
    workspaceChoices(workspaces, sessions),
  );
  const defaults = useNewSessionDefaults(host.hostId, workspaceId, draft).data;
  const agentType = defaults?.agentType ?? null;
  const agents = useAgents(host.hostId).data ?? [];
  const models = useCompatibleModels(host.hostId, agentType).data ?? [];
  const selectedMode = defaults?.permissionMode ?? null;

  return (
    <BrandHost style={styles.fill}>
      <Form>
        <FormSection title={t("newSession.agent")}>
          {agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              selected={agent.id === agentType}
            />
          ))}
        </FormSection>
        <FormSection
          title={t("newSession.model")}
          footer={
            <Text textStyle={{ color: colors.mutedForeground }}>
              {models.length > 0
                ? t("newSession.modelsFromComputer")
                : t("newSession.agentDefaultModel")}
            </Text>
          }
        >
          {models.map(({ provider, model }) => (
            <FormRow
              key={`${provider.id}/${model.modelId}`}
              onPress={() => {
                if (!agentType) return;
                updateNewSessionDraft((current) =>
                  chooseModel(current, agentType, {
                    providerId: provider.id,
                    modelId: model.modelId,
                  }),
                );
              }}
              supportingText={
                <Text textStyle={{ color: colors.mutedForeground }}>
                  {provider.name}
                </Text>
              }
              trailing={
                <SelectedMark
                  selected={
                    defaults?.model?.providerId === provider.id &&
                    defaults.model.modelId === model.modelId
                  }
                />
              }
            >
              <Text>{model.name}</Text>
            </FormRow>
          ))}
        </FormSection>
        <FormSection
          title={t("newSession.mode")}
          footer={
            <Text textStyle={{ color: colors.mutedForeground }}>
              {selectedMode
                ? modeLabels[selectedMode].description
                : t("newSession.noModes")}
            </Text>
          }
        >
          {(defaults?.permissionModes ?? []).map((mode) => (
            <FormRow
              key={mode}
              onPress={() => {
                if (!agentType) return;
                updateNewSessionDraft((current) =>
                  choosePermissionMode(current, agentType, mode),
                );
              }}
              trailing={<SelectedMark selected={mode === selectedMode} />}
            >
              <Text>{modeLabels[mode].label}</Text>
            </FormRow>
          ))}
        </FormSection>
      </Form>
    </BrandHost>
  );
}

export function AgentPicker() {
  const { hostId } = useNewSessionState();
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  return host ? <Picker host={host} /> : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
