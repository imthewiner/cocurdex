import type { SkillDocument, SkillFileEntry } from "@cocurdex/shared";
import { FileCode2, FileText, FolderOpen, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "@/components";
import { Button, Text } from "@/components/ui";
import { desktopApi } from "@/lib";
import { formatBytes } from "./skill-library-model";

export function SkillScriptWarning({ count }: { count: number }) {
  const { t } = useTranslation("settings");
  if (count === 0) {
    return null;
  }
  return (
    <div className="flex items-start gap-2 py-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" />
      <Text size="meta" tone="muted">
        {t("skills.files.scriptWarning", { count })}
      </Text>
    </div>
  );
}

export function SkillFilesSection({
  files,
  revealPath,
  scriptCount,
}: {
  files: SkillFileEntry[];
  revealPath: string | null;
  scriptCount: number;
}) {
  const { t } = useTranslation("settings");
  const canReveal = Boolean(revealPath) && desktopApi.capabilities.fileManager;
  return (
    <SettingsGroup
      action={
        canReveal && revealPath ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void desktopApi.revealPathInFileManager(revealPath)}
          >
            <FolderOpen className="size-4" />
            {t("skills.files.reveal")}
          </Button>
        ) : null
      }
      title={t("skills.files.title", { count: files.length })}
    >
      <SkillScriptWarning count={scriptCount} />
      <ul
        aria-label={t("skills.files.title", { count: files.length })}
        className="flex flex-col py-2"
      >
        {files.map((file) => (
          <li
            className="flex h-7 items-center gap-2"
            data-item-path={file.path}
            key={file.path}
          >
            {file.kind === "script" ? (
              <FileCode2 className="size-3.5 shrink-0 text-status-warning" />
            ) : (
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <Text className="min-w-0 flex-1 font-mono" size="meta" truncate>
              {file.path}
            </Text>
            <Text className="shrink-0 tabular-nums" size="meta" tone="muted">
              {formatBytes(file.size)}
            </Text>
          </li>
        ))}
      </ul>
    </SettingsGroup>
  );
}

export function SkillDocumentSection({
  document,
}: {
  document: SkillDocument | null;
}) {
  const { t } = useTranslation("settings");
  if (!document) {
    return null;
  }
  return (
    <SettingsGroup title="SKILL.md">
      <pre className="max-h-96 overflow-auto py-3 font-mono text-meta whitespace-pre-wrap break-words text-foreground/90">
        {document.content}
      </pre>
      {document.truncated ? (
        <Text as="div" className="py-2" size="meta" tone="muted">
          {t("skills.document.truncated")}
        </Text>
      ) : null}
    </SettingsGroup>
  );
}
