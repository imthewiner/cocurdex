import {
  ChevronDown,
  ClipboardPaste,
  Download,
  FileUp,
  PenLine,
  Plus,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { type JsonTextHandler, useJsonFileImport } from "../json-file-import";
import { JsonFileInput } from "../json-import-dropzone";
import { JsonPasteDialog } from "../json-paste-dialog";

export function McpAddMenu({
  variant,
  onAddManually,
  onImportAgents,
  onText,
}: {
  variant: "default" | "outline" | "secondary";
  onAddManually(): void;
  onImportAgents?: () => void;
  onText: JsonTextHandler;
}) {
  const { t } = useTranslation("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const { importFile } = useJsonFileImport({
    invalidFileMessage: t("mcp.jsonImport.invalidFile"),
    onText,
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button className="shrink-0" type="button" variant={variant}>
              <Plus className="size-4" />
              {t("mcp.empty.add")}
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={onAddManually}>
            <PenLine className="size-3.5" />
            {t("mcp.empty.addManually")}
          </DropdownMenuItem>
          {onImportAgents ? (
            <DropdownMenuItem onClick={onImportAgents}>
              <Download className="size-3.5" />
              {t("mcp.list.importFromAgents")}
            </DropdownMenuItem>
          ) : null}
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
      <JsonFileInput inputRef={fileInputRef} onFile={importFile} />
      <JsonPasteDialog
        description={t("mcp.jsonImport.pasteDescription")}
        open={isPasteOpen}
        title={t("mcp.jsonImport.pasteTitle")}
        onOpenChange={setIsPasteOpen}
        onText={onText}
      />
    </>
  );
}
