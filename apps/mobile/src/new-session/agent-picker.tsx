import type { SavedHost } from "@cocurdex/client-runtime";
import {
  type AgentAvailability,
  type AgentDescriptor,
  type AgentRoleRecord,
  getSessionRuntimeAxes,
} from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import {
  AgentIcon,
  RoleAvatar,
  useAgentRoles,
  useAgents,
  useCompatibleModels,
  usePermissionModeLabels,
} from "@/agents";
import { useSavedHosts } from "@/hosts";
import { RuntimeSections } from "@/session-runtime";
import { useHostSessions } from "@/sessions";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  Form,
  FormRow,
  FormSection,
  HostedAccessory,
  SelectedMark,
} from "@/ui";
import {
  chooseAgent,
  chooseModel,
  choosePermissionMode,
  chooseRole,
  chooseRuntime,
  displayedChoices,
  displayedRuntime,
  draftWorkspaceId,
  workspaceChoices,
} from "./new-session-draft";
import { useNewSessionDefaults } from "./new-session-queries";
import { updateNewSessionDraft, useNewSessionState } from "./new-session-store";

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
      testID={`new-session-agent-${agent.id}`}
      onPress={
        available
          ? () => updateNewSessionDraft((draft) => chooseAgent(draft, agent.id))
          : undefined
      }
      leading={
        <HostedAccessory>
          <AgentIcon agentId={agent.id} size={20} />
        </HostedAccessory>
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

function RoleRow({
  role,
  agent,
  selected,
}: {
  role: AgentRoleRecord;
  agent: AgentDescriptor | undefined;
  selected: boolean;
}) {
  const colors = useThemeColors();
  const available = agent?.availability === "available";
  return (
    <FormRow
      testID={`new-session-role-${role.id}`}
      onPress={
        available
          ? () => updateNewSessionDraft((draft) => chooseRole(draft, role))
          : undefined
      }
      leading={
        <HostedAccessory>
          <RoleAvatar role={role} agentId={role.agentId} size={28} />
        </HostedAccessory>
      }
      supportingText={
        <Text textStyle={{ color: colors.mutedForeground }}>
          {[agent?.label ?? role.agentId, role.modelName]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      }
      trailing={<SelectedMark selected={selected} />}
    >
      <Text
        textStyle={available ? undefined : { color: colors.mutedForeground }}
      >
        {role.name}
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
  const shown = displayedChoices(draft, defaults);
  const agentType = shown.agentType;
  const agents = useAgents(host.hostId).data ?? [];
  const roles = useAgentRoles(host.hostId).data ?? [];
  const roleId = roles.some((role) => role.id === draft.roleId)
    ? draft.roleId
    : undefined;
  const models = useCompatibleModels(host.hostId, agentType).data ?? [];
  const selectedMode = shown.permissionMode;
  const selectedModel = models.find(
    ({ provider, model }) =>
      shown.model?.providerId === provider.id &&
      shown.model.modelId === model.modelId,
  )?.model;
  const role = roles.find((entry) => entry.id === roleId);
  const axes = agentType
    ? getSessionRuntimeAxes(
        agentType,
        selectedModel,
        displayedRuntime(draft, agentType, role),
      )
    : null;

  return (
    <BrandHost style={styles.fill}>
      <Form>
        {roles.length > 0 ? (
          <FormSection
            title={t("newSession.role")}
            footer={
              <Text textStyle={{ color: colors.mutedForeground }}>
                {t("newSession.roleFooter")}
              </Text>
            }
          >
            {roles.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                agent={agents.find((agent) => agent.id === role.agentId)}
                selected={role.id === roleId}
              />
            ))}
          </FormSection>
        ) : null}
        <FormSection title={t("newSession.agent")}>
          {agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              selected={!roleId && agent.id === agentType}
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
                    shown.model?.providerId === provider.id &&
                    shown.model.modelId === model.modelId
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
          {shown.permissionModes.map((mode) => (
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
        {axes && agentType ? (
          <RuntimeSections
            axes={axes}
            onChange={(patch) =>
              updateNewSessionDraft((current) =>
                chooseRuntime(current, agentType, patch),
              )
            }
          />
        ) : null}
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
