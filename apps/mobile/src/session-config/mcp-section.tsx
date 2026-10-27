import {
  type AgentMcpServerRuntime,
  getMcpStatusKind,
  type McpStatusKind,
} from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/theme";
import { FormRow, FormSection } from "@/ui";

function useStatusLabels(): Record<Exclude<McpStatusKind, "unknown">, string> {
  const { t } = useTranslation("sessions");
  return {
    connected: t("sessionConfig.mcpStatus.connected"),
    connecting: t("sessionConfig.mcpStatus.connecting"),
    disabled: t("sessionConfig.mcpStatus.disabled"),
    failed: t("sessionConfig.mcpStatus.failed"),
  };
}

export function McpSection({
  servers,
}: {
  servers: readonly AgentMcpServerRuntime[];
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const labels = useStatusLabels();
  return (
    <FormSection
      title={t("sessionConfig.mcp")}
      footer={
        servers.length === 0 ? (
          <Text textStyle={{ color: colors.mutedForeground }}>
            {t("sessionConfig.mcpNone")}
          </Text>
        ) : undefined
      }
    >
      {servers.map((server) => {
        const kind = getMcpStatusKind(server.status);
        return (
          <FormRow
            key={server.name}
            testID={`session-config-mcp-${server.name}`}
            supportingText={
              <Text
                textStyle={{
                  color:
                    kind === "failed"
                      ? colors.destructive
                      : colors.mutedForeground,
                }}
              >
                {kind === "unknown" ? server.status : labels[kind]}
              </Text>
            }
          >
            <Text>{server.name}</Text>
          </FormRow>
        );
      })}
    </FormSection>
  );
}
