import type { McpServerConfig, McpServerScope } from "@cocurdex/shared";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Input, Text } from "@/components/ui";
import type { JsonTextHandler } from "../json-file-import";
import { SettingsListItem } from "../settings-list-item";
import { McpAddMenu } from "./mcp-add-menu";
import {
  type McpSelection,
  matchesServerQuery,
  serverDotState,
  serverSummary,
} from "./mcp-selection";
import { McpStatusDot } from "./mcp-status-dot";
import { type McpStatusState, mcpStatusKey } from "./use-mcp-settings";

interface McpServerGroupProps {
  label: string;
  readOnly?: boolean;
  scope: McpServerScope;
  selection: McpSelection | null;
  servers: [string, McpServerConfig][];
  status: McpStatusState;
  onSelect(selection: McpSelection): void;
}

function McpServerGroup({
  label,
  readOnly = false,
  scope,
  selection,
  servers,
  status,
  onSelect,
}: McpServerGroupProps) {
  const { t } = useTranslation("settings");
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <div className="flex h-5 items-center gap-2 px-1">
        <Text size="meta" tone="muted" weight="medium">
          {label}
        </Text>
        {readOnly ? (
          <Badge variant="outline">{t("mcp.list.readOnly")}</Badge>
        ) : null}
      </div>
      {servers.map(([name, config]) => (
        <SettingsListItem
          dataAttributes={{ "data-mcp-server": name, "data-mcp-scope": scope }}
          isActive={selection?.scope === scope && selection.name === name}
          key={name}
          subtitle={serverSummary(config)}
          title={name}
          trailing={
            <McpStatusDot
              state={serverDotState(
                config,
                status.byKey[mcpStatusKey(scope, name)],
              )}
            />
          }
          onClick={() => onSelect({ scope, name })}
        />
      ))}
    </section>
  );
}

export function McpServerList({
  project,
  query,
  selection,
  servers,
  status,
  workspaceName,
  onAdd,
  onImport,
  onQueryChange,
  onSelect,
  onText,
}: {
  project: Record<string, McpServerConfig> | null;
  query: string;
  selection: McpSelection | null;
  servers: Record<string, McpServerConfig>;
  status: McpStatusState;
  workspaceName: string | null;
  onAdd(): void;
  onImport(): void;
  onQueryChange(query: string): void;
  onSelect(selection: McpSelection): void;
  onText: JsonTextHandler;
}) {
  const { t } = useTranslation("settings");
  const globalEntries = Object.entries(servers).filter(([name, config]) =>
    matchesServerQuery(name, config, query),
  );
  const projectEntries = Object.entries(project ?? {}).filter(
    ([name, config]) => matchesServerQuery(name, config, query),
  );
  const isEmpty = globalEntries.length === 0 && projectEntries.length === 0;

  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
          <Input
            aria-label={t("mcp.list.search")}
            className="h-8 rounded-control border-border/70 bg-background/60 ps-9 pe-3 text-body shadow-none placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20"
            placeholder={t("mcp.list.search")}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <McpAddMenu
          variant="secondary"
          onAddManually={onAdd}
          onImportAgents={onImport}
          onText={onText}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-4 pe-1">
          {isEmpty && query.trim() ? (
            <Text className="px-1" size="body" tone="muted">
              {t("mcp.list.noMatches")}
            </Text>
          ) : null}
          {globalEntries.length > 0 ? (
            <McpServerGroup
              label={t("mcp.list.global")}
              scope="global"
              selection={selection}
              servers={globalEntries}
              status={status}
              onSelect={onSelect}
            />
          ) : null}
          {projectEntries.length > 0 ? (
            <McpServerGroup
              label={t("mcp.list.project", { workspace: workspaceName ?? "" })}
              readOnly
              scope="project"
              selection={selection}
              servers={projectEntries}
              status={status}
              onSelect={onSelect}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
