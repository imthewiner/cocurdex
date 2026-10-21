import type {
  McpConfigFile,
  McpServerConfig,
  McpServerStatus,
} from "@cocurdex/shared";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { desktopApi } from "@/lib";
import { JsonImportDropzone } from "../json-import-dropzone";
import { McpEmptyState } from "./mcp-empty-state";
import { McpImportDialog } from "./mcp-import-dialog";
import {
  importableAgentSummary,
  importItemsFromCandidates,
  importItemsFromJson,
  type McpImportItem,
} from "./mcp-import-items";
import { McpJsonEditor } from "./mcp-json-editor";
import { type McpSelection, resolveSelection } from "./mcp-selection";
import { McpServerDetail } from "./mcp-server-detail";
import { nextServerName } from "./mcp-server-form";
import { McpServerList } from "./mcp-server-list";
import { type McpEditorMode, McpSettingsHeader } from "./mcp-settings-header";
import { McpToolsCard } from "./mcp-tools-card";
import { mcpStatusKey, useMcpSettings } from "./use-mcp-settings";

interface ImportState {
  kind: "agents" | "json";
  items: McpImportItem[] | null;
  loadError: string;
  open: boolean;
}

type McpPanelView = "json" | "empty" | "pending" | "servers";

function panelView({
  mode,
  isEmpty,
  hasCandidates,
}: {
  mode: McpEditorMode;
  isEmpty: boolean;
  hasCandidates: boolean;
}): McpPanelView {
  if (mode === "json") return "json";
  if (!isEmpty) return "servers";
  return hasCandidates ? "empty" : "pending";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function McpSettingsPanel() {
  const { t } = useTranslation("settings");
  const mcp = useMcpSettings();
  const [mode, setMode] = useState<McpEditorMode>("form");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<McpSelection | null>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [importSession, setImportSession] = useState(0);
  const importSessionRef = useRef(0);
  const [newServerStatus, setNewServerStatus] =
    useState<McpServerStatus | null>(null);
  const globalNames = Object.keys(mcp.servers);
  const projectServers = mcp.project?.servers ?? {};
  const active = resolveSelection(
    selection,
    globalNames,
    Object.keys(projectServers),
  );

  if (!mcp.configFile) {
    return mcp.loadError ? (
      <Text role="alert" size="meta" tone="destructive">
        {mcp.loadError}
      </Text>
    ) : (
      <div className="min-h-40" />
    );
  }
  const configFile = mcp.configFile;

  const applySaved = (file: McpConfigFile) => {
    mcp.applyConfigFile(file);
  };

  const openImport = (kind: ImportState["kind"], items: McpImportItem[]) => {
    importSessionRef.current += 1;
    setImportSession(importSessionRef.current);
    setImportState({ kind, items, loadError: "", open: true });
  };

  const scanAgents = async () => {
    importSessionRef.current += 1;
    const session = importSessionRef.current;
    setImportSession(session);
    setImportState({ kind: "agents", items: null, loadError: "", open: true });
    try {
      const candidates = await desktopApi.scanMcpImports(mcp.workspaceId);
      if (session !== importSessionRef.current) return;
      setImportState((current) =>
        current
          ? {
              ...current,
              items: importItemsFromCandidates(candidates, (candidate) =>
                t(`mcp.import.source.${candidate.source}`),
              ),
            }
          : current,
      );
    } catch (error) {
      if (session !== importSessionRef.current) return;
      setImportState((current) =>
        current
          ? { ...current, items: [], loadError: errorMessage(error) }
          : current,
      );
    }
  };

  const importJsonText = (text: string) => {
    try {
      openImport(
        "json",
        importItemsFromJson(text, mcp.servers, {
          source: t("mcp.import.source.json"),
          invalidName: t("mcp.errors.nameInvalid"),
        }),
      );
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  };

  const mergeServers = async (servers: Record<string, McpServerConfig>) => {
    applySaved(await desktopApi.mergeMcpServers(servers));
    const [first] = Object.keys(servers);
    if (first) setSelection({ scope: "global", name: first });
    void mcp.refreshStatus();
  };

  const startNewServer = () => {
    setNewServerStatus(null);
    setSelection({ scope: "new" });
  };

  const hasNoServers =
    globalNames.length === 0 && Object.keys(projectServers).length === 0;
  const view = panelView({
    mode,
    isEmpty: hasNoServers && active === null,
    hasCandidates: mcp.importCandidates !== null,
  });

  const detail = (() => {
    if (!active) return null;
    if (active.scope === "new") {
      return {
        key: "new",
        name: nextServerName(globalNames),
        config: { command: "" } as McpServerConfig,
        sourcePath: configFile.path,
      };
    }
    const config =
      active.scope === "global"
        ? mcp.servers[active.name]
        : projectServers[active.name];
    if (!config) return null;
    return {
      key: `${active.scope}:${active.name}`,
      name: active.name,
      config,
      sourcePath:
        active.scope === "project"
          ? (mcp.project?.path ?? "")
          : configFile.path,
    };
  })();
  const detailStatus = (() => {
    if (!active) return undefined;
    if (active.scope === "new") return newServerStatus ?? undefined;
    return mcp.status.byKey[mcpStatusKey(active.scope, active.name)];
  })();

  return (
    <div className="settings-panel-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5">
      <McpSettingsHeader
        configPath={configFile.path}
        errors={mcp.status.errors}
        mode={mode}
        onModeChange={setMode}
      />

      {view === "json" ? (
        <McpJsonEditor
          file={configFile}
          key={configFile.content}
          onSaved={(file) => {
            applySaved(file);
            void mcp.refreshStatus();
          }}
        />
      ) : null}
      {view === "empty" ? (
        <McpEmptyState
          summary={importableAgentSummary(mcp.importCandidates ?? [])}
          onAddManually={startNewServer}
          onImportAgents={() => void scanAgents()}
          onText={importJsonText}
        />
      ) : null}
      {view === "servers" ? (
        <div className="flex min-h-0 min-w-0 flex-1 gap-6">
          <McpServerList
            project={mcp.project?.servers ?? null}
            query={query}
            selection={active}
            servers={mcp.servers}
            status={mcp.status}
            workspaceName={mcp.workspaceName}
            onAdd={startNewServer}
            onImport={() => void scanAgents()}
            onQueryChange={setQuery}
            onSelect={setSelection}
            onText={importJsonText}
          />
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            <div className="flex min-w-0 flex-col gap-6 pe-1">
              {detail && active ? (
                <McpServerDetail
                  config={detail.config}
                  key={detail.key}
                  name={detail.name}
                  otherNames={globalNames.filter(
                    (name) => active.scope === "new" || name !== detail.name,
                  )}
                  scope={active.scope}
                  sourcePath={detail.sourcePath}
                  status={detailStatus}
                  workspaceId={mcp.workspaceId}
                  onEnabledSaved={(file) => {
                    applySaved(file);
                    void mcp.refreshServerStatus(detail.name);
                  }}
                  onRemoved={(file) => {
                    applySaved(file);
                    mcp.forgetStatus(detail.name);
                    setSelection(null);
                  }}
                  onSaved={(file, name) => {
                    applySaved(file);
                    if (name !== detail.name) mcp.forgetStatus(detail.name);
                    setSelection({ scope: "global", name });
                    void mcp.refreshServerStatus(name);
                  }}
                  onSignInChanged={(name) => void mcp.refreshServerStatus(name)}
                  onTested={(result) => {
                    if (active.scope === "new") setNewServerStatus(result);
                    else mcp.applyStatus(result);
                  }}
                />
              ) : null}
              {detail ? (
                <McpToolsCard
                  isChecking={mcp.status.isChecking && !detailStatus}
                  status={detailStatus}
                />
              ) : null}
              <JsonImportDropzone
                dropActiveHint={t("mcp.jsonImport.dropActive")}
                dropHint={t("mcp.jsonImport.dropHint")}
                intro={t("mcp.jsonImport.intro")}
                invalidFileMessage={t("mcp.jsonImport.invalidFile")}
                label={t("mcp.jsonImport.label")}
                pasteDescription={t("mcp.jsonImport.pasteDescription")}
                pasteTitle={t("mcp.jsonImport.pasteTitle")}
                title={t("mcp.jsonImport.title")}
                onText={importJsonText}
              />
            </div>
          </div>
        </div>
      ) : null}

      <McpImportDialog
        description={
          importState?.kind === "json"
            ? t("mcp.import.jsonDescription")
            : t("mcp.import.agentsDescription")
        }
        emptyText={t("mcp.import.empty")}
        items={importState?.items ?? null}
        key={importSession}
        loadError={importState?.loadError ?? ""}
        open={importState?.open === true}
        title={
          importState?.kind === "json"
            ? t("mcp.import.jsonTitle")
            : t("mcp.import.agentsTitle")
        }
        onImport={mergeServers}
        onOpenChange={(open) => {
          if (!open) {
            setImportState((current) =>
              current ? { ...current, open: false } : current,
            );
          }
        }}
      />
    </div>
  );
}
