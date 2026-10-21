import {
  ChevronDown,
  ClipboardPaste,
  Download,
  FileUp,
  PenLine,
  Plus,
  Server,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Text,
} from "@/components/ui";
import { cn } from "@/lib";
import {
  type JsonTextHandler,
  useFileDropTarget,
  useJsonFileImport,
} from "../json-file-import";
import { JsonFileInput } from "../json-import-dropzone";
import { JsonPasteDialog } from "../json-paste-dialog";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const { importFile, importFiles } = useJsonFileImport({
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant={canImportAgents ? "outline" : "default"}
                  >
                    <Plus className="size-4" />
                    {t("mcp.empty.add")}
                    <ChevronDown className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuItem onClick={onAddManually}>
                  <PenLine className="size-3.5" />
                  {t("mcp.empty.addManually")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsPasteOpen(true)}>
                  <ClipboardPaste className="size-3.5" />
                  {t("jsonImport.pasteButton")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="size-3.5" />
                  {t("mcp.empty.chooseFile")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      <JsonFileInput inputRef={fileInputRef} onFile={importFile} />
      <JsonPasteDialog
        description={t("mcp.jsonImport.pasteDescription")}
        open={isPasteOpen}
        title={t("mcp.jsonImport.pasteTitle")}
        onOpenChange={setIsPasteOpen}
        onText={onText}
      />
    </section>
  );
}
