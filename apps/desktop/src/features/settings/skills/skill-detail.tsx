import type {
  InstalledSkill,
  InstalledSkillDetail,
  SkillLinkAgent,
} from "@cocurdex/shared";
import { ArrowUpCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppConfirmDialog } from "@/components";
import { Badge, Button, Text } from "@/components/ui";
import { SkillAgentsSection } from "./skill-agents-section";
import { SkillDocumentSection, SkillFilesSection } from "./skill-files-section";
import { SkillInfoList } from "./skill-info-list";
import { hasPendingUpdate, skillRef } from "./skill-library-model";
import { SkillProblemsSection } from "./skill-problems-section";
import { SkillUpdateDialog } from "./skill-update-dialog";
import { skillsApi } from "./skills-api";
import { useSkillDetail } from "./use-skill-detail";

export function SkillDetail({
  skill,
  onChanged,
  onRemoved,
}: {
  skill: InstalledSkill;
  onChanged(): void;
  onRemoved(): void;
}) {
  const { t } = useTranslation("settings");
  const ref = skillRef(skill);
  const { detail, error, isBusy, run } = useSkillDetail(ref);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const current = detail?.skill ?? skill;

  const mutate = async (action: () => Promise<InstalledSkillDetail>) => {
    if (await run(action)) {
      onChanged();
    }
  };

  const toggleAgent = (agent: SkillLinkAgent, enabled: boolean) =>
    void mutate(() => skillsApi.setAgentLink({ ...ref, agent, enabled }));

  const remove = async () => {
    setIsRemoveOpen(false);
    const removed = await run(async () => {
      await skillsApi.remove(ref);
      return null;
    });
    if (removed) {
      onRemoved();
    }
  };

  return (
    <section
      aria-label={t("skills.detail.label", { name: current.name })}
      className="flex flex-col gap-6"
      data-skill-detail={current.name}
    >
      <div className="flex flex-col gap-2">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Text
              as="h2"
              className="font-mono"
              size="display"
              weight="semibold"
            >
              {current.name}
            </Text>
            {hasPendingUpdate(current) ? (
              <Badge variant="secondary">
                {t("skills.detail.updateBadge")}
              </Badge>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {current.builtin ? null : (
              <Button
                className="text-muted-foreground hover:text-destructive"
                disabled={isBusy}
                size="sm"
                variant="ghost"
                onClick={() => setIsRemoveOpen(true)}
              >
                <Trash2 className="size-4" />
                {t("skills.actions.remove")}
              </Button>
            )}
            {current.update ? (
              <Button
                disabled={isBusy}
                size="sm"
                variant="outline"
                onClick={() => setIsUpdateOpen(true)}
              >
                <ArrowUpCircle className="size-4" />
                {t("skills.detail.reviewUpdate")}
              </Button>
            ) : null}
          </div>
        </div>
        {current.description ? (
          <Text size="body" tone="muted">
            {current.description}
          </Text>
        ) : null}
        {error ? (
          <Text role="alert" size="meta" tone="destructive">
            {error}
          </Text>
        ) : null}
      </div>

      <SkillInfoList
        license={detail?.document?.license ?? null}
        skill={current}
      />

      <SkillProblemsSection
        disabled={isBusy}
        problems={current.problems}
        onKeepCopy={(keepPath) =>
          void mutate(() => skillsApi.resolveDuplicate({ ...ref, keepPath }))
        }
      />

      {current.agents.length > 0 ? (
        <SkillAgentsSection
          disabled={isBusy || current.builtin}
          skill={current}
          onShare={() => void mutate(() => skillsApi.share(ref))}
          onToggle={toggleAgent}
        />
      ) : null}

      {detail ? (
        <>
          <SkillFilesSection
            files={detail.files}
            revealPath={current.path}
            scriptCount={current.scriptCount}
          />
          <SkillDocumentSection document={detail.document} />
        </>
      ) : null}

      <AppConfirmDialog
        cancelLabel={t("skills.actions.cancel")}
        confirmLabel={t("skills.actions.remove")}
        description={t("skills.detail.removeDescription", {
          name: current.name,
        })}
        open={isRemoveOpen}
        title={t("skills.detail.removeTitle", { name: current.name })}
        variant="destructive"
        onConfirm={() => void remove()}
        onOpenChange={setIsRemoveOpen}
      />
      {isUpdateOpen && current.update ? (
        <SkillUpdateDialog
          skill={current}
          onClose={() => setIsUpdateOpen(false)}
          onUpdated={() => void mutate(() => skillsApi.show(ref))}
        />
      ) : null}
    </section>
  );
}
