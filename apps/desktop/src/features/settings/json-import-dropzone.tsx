import { ClipboardPaste, FileUp } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib";
import { isJsonImportFile } from "./import-json-file";

function dataTransferHasFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }
  return Array.from(dataTransfer.types).includes("Files");
}

interface JsonImportDropzoneProps {
  label: string;
  intro: string;
  title: string;
  dropHint: string;
  dropActiveHint: string;
  invalidFileMessage: string;
  pasteTitle: string;
  pasteDescription: string;
  onText(text: string): Promise<string | null> | string | null;
}

function JsonPasteDialog({
  open,
  title,
  description,
  onOpenChange,
  onText,
}: {
  open: boolean;
  title: string;
  description: string;
  onOpenChange(open: boolean): void;
  onText(text: string): Promise<string | null> | string | null;
}) {
  const { t } = useTranslation("settings");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const nextError = await onText(text);
    if (nextError) {
      setError(nextError);
      return;
    }
    setText("");
    setError("");
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setError("");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-2">
          <Textarea
            aria-invalid={Boolean(error)}
            aria-label={t("jsonImport.pasteLabel")}
            className="min-h-48 resize-y rounded-control border-border/70 bg-background/60 font-mono text-body shadow-none focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20"
            placeholder={t("jsonImport.pastePlaceholder")}
            spellCheck={false}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError("");
            }}
          />
          {error ? (
            <Text role="alert" size="meta" tone="destructive">
              {error}
            </Text>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("jsonImport.cancel")}
          </Button>
          <Button
            disabled={!text.trim()}
            type="button"
            onClick={() => void submit()}
          >
            {t("jsonImport.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JsonImportDropzone({
  label,
  intro,
  title,
  dropHint,
  dropActiveHint,
  invalidFileMessage,
  pasteTitle,
  pasteDescription,
  onText,
}: JsonImportDropzoneProps) {
  const { t } = useTranslation("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!isJsonImportFile(file)) {
      toast.error(invalidFileMessage);
      return;
    }
    const error = await onText(await file.text());
    if (error) {
      toast.error(error);
    }
  }

  function handleDragEnter(event: DragEvent<HTMLButtonElement>) {
    if (!dataTransferHasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    if (!dataTransferHasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    if (!dataTransferHasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    if (!dataTransferHasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files);
    void handleFile(
      files.find((candidate) => isJsonImportFile(candidate)) ?? files[0],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text size="sm" weight="medium">
            {label}
          </Text>
          <Text size="2xs" tone="muted">
            {intro}
          </Text>
        </div>
        <Button
          className="shrink-0"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => setIsPasteOpen(true)}
        >
          <ClipboardPaste className="size-4" />
          {t("jsonImport.pasteButton")}
        </Button>
      </div>
      <button
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-control border border-dashed border-border/60 px-6 py-6 text-center transition-colors hover:bg-muted/45 hover:text-foreground focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none",
          isDraggingFile && "border-primary/40 bg-primary/10",
        )}
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <FileUp className="size-5 text-muted-foreground" />
        <Text size="sm" weight="medium">
          {title}
        </Text>
        <Text size="xs" tone="muted">
          {isDraggingFile ? dropActiveHint : dropHint}
        </Text>
      </button>
      <input
        accept=".json,application/json,text/plain"
        aria-hidden="true"
        className="sr-only"
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void handleFile(file);
        }}
      />
      <JsonPasteDialog
        description={pasteDescription}
        open={isPasteOpen}
        title={pasteTitle}
        onOpenChange={setIsPasteOpen}
        onText={onText}
      />
    </div>
  );
}
