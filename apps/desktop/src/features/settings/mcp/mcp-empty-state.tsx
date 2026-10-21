import { Download, FileUp, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Text } from "@/components/ui";
import { cn } from "@/lib";
import {
  type JsonTextHandler,
  useFileDropTarget,
  useJsonFileImport,
} from "../json-file-import";
import { McpAddMenu } from "./mcp-add-menu";
import type { McpImportAgentSummary } from "./mcp-import-items";

export function McpEmptyState({
  summary,
  onAddManually,
  onImportAgents,
  onText,
}: {
  summary: McpImportAgentSummary;
  onAddManually(): void;
  onImportAgents(): void;
  onText: JsonTextHandler;
}) {
  const { t, i18n } = useTranslation("settings");
  const { importFiles } = useJsonFileImport({
    invalidFileMessage: t("mcp.jsonImport.invalidFile"),
    onText,
  });
  const { isDraggingFile, dropHandlers } = useFileDropTarget(importFiles);
  const canImportAgents = summary.count > 0;
  const agents = new Intl.ListFormat(i18n.language, {
    type: "conjunction",
  }).format(summary.agents.map((agent) => t(`mcp.import.source.${agent}`)));

  return (
    <section
      aria-label={t("mcp.empty.title")}
      className="relative flex min-h-0 flex-1 flex-col"
      data-testid="mcp-empty-state"
      {...dropHandlers}
    >
      <EmptyState
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canImportAgents ? (
              <Button type="button" onClick={onImportAgents}>
                <Download className="size-4" />
                {t("mcp.list.importFromAgents")}
              </Button>
            ) : null}
            <McpAddMenu
              label={t("mcp.empty.add")}
              variant={canImportAgents ? "outline" : "default"}
              onAddManually={onAddManually}
              onText={onText}
            />
          </div>
        }
        className={cn("flex-1 pb-24", isDraggingFile && "opacity-30")}
        description={
          canImportAgents
            ? t("mcp.empty.discovered", { count: summary.count, agents })
            : t("mcp.empty.description")
        }
        icon={<Server />}
        title={t("mcp.empty.title")}
      />
      {isDraggingFile ? (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-card border border-dashed border-foreground/40 bg-background/80 text-center"
          role="status"
        >
          <FileUp className="mb-2 size-6 text-muted-foreground" />
          <Text size="sm" weight="medium">
            {t("mcp.jsonImport.dropActive")}
          </Text>
          <Text size="xs" tone="muted">
            {t("mcp.empty.dropHint")}
          </Text>
        </div>
      ) : null}
    </section>
  );
}
