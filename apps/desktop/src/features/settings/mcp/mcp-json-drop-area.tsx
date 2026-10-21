import { FileUp } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { cn } from "@/lib";
import {
  type JsonTextHandler,
  useFileDropTarget,
  useJsonFileImport,
} from "../json-file-import";

export function McpJsonDropArea({
  label,
  className,
  onText,
  children,
}: {
  label?: string;
  className?: string;
  onText: JsonTextHandler;
  children: ReactNode;
}) {
  const { t } = useTranslation("settings");
  const { importFiles } = useJsonFileImport({
    invalidFileMessage: t("mcp.jsonImport.invalidFile"),
    onText,
  });
  const { isDraggingFile, dropHandlers } = useFileDropTarget(importFiles);

  return (
    <section
      aria-label={label}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      {...dropHandlers}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1",
          className,
          isDraggingFile && "opacity-30",
        )}
      >
        {children}
      </div>
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
