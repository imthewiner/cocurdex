import type { InstalledSkill } from "@cocurdex/shared";
import { RefreshCw, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, Input, Spinner, Text } from "@/components/ui";
import { SettingsListItem } from "../settings-list-item";
import {
  type InstalledSkillGroups,
  type SkillDotState,
  type SkillSelection,
  skillDotState,
  skillKey,
  skillRef,
  sourceDisplay,
} from "./skill-library-model";
import { SkillStatusDot } from "./skill-status-dot";

function SkillGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <div className="flex h-5 items-center px-1">
        <Text size="meta" tone="muted" weight="medium">
          {label}
        </Text>
      </div>
      {children}
    </section>
  );
}

function SkillRow({
  selection,
  skill,
  onSelect,
}: {
  selection: SkillSelection | null;
  skill: InstalledSkill;
  onSelect(selection: SkillSelection): void;
}) {
  const { t } = useTranslation("settings");
  const key = skillKey(skillRef(skill));
  return (
    <SettingsListItem
      dataAttributes={{
        "data-skill": skill.name,
        "data-skill-scope": skill.scope,
      }}
      isActive={selection?.kind === "skill" && selection.key === key}
      subtitle={sourceDisplay(skill.source) ?? t("skills.source.unknown")}
      title={skill.name}
      trailing={<SkillStatusDot state={skillDotState(skill)} />}
      onClick={() => onSelect({ kind: "skill", key })}
    />
  );
}

export function SkillList({
  groups,
  isChecking,
  packDot,
  packSubtitle,
  query,
  selection,
  workspaceName,
  onCheckUpdates,
  onQueryChange,
  onSelect,
}: {
  groups: InstalledSkillGroups;
  isChecking: boolean;
  packDot: SkillDotState | null;
  packSubtitle: string;
  query: string;
  selection: SkillSelection | null;
  workspaceName: string | null;
  onCheckUpdates(): void;
  onQueryChange(query: string): void;
  onSelect(selection: SkillSelection): void;
}) {
  const { t } = useTranslation("settings");
  const sections = [
    { id: "global", label: t("skills.list.global"), skills: groups.global },
    {
      id: "workspace",
      label: t("skills.list.workspace", { workspace: workspaceName ?? "" }),
      skills: groups.workspace,
    },
    {
      id: "problems",
      label: t("skills.list.problems"),
      skills: groups.problems,
    },
  ].filter((section) => section.skills.length > 0);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
          <Input
            aria-label={t("skills.list.filter")}
            className="h-8 rounded-control border-border/70 bg-background/60 ps-9 pe-3 text-body shadow-none placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20"
            placeholder={t("skills.list.filter")}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <IconButton
          aria-busy={isChecking}
          aria-label={t("skills.list.checkUpdates")}
          disabled={isChecking}
          size="sm"
          variant="outline"
          onClick={onCheckUpdates}
        >
          {isChecking ? (
            <Spinner size="sm" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-4 pe-1">
          {hasQuery ? null : (
            <SkillGroup label={t("skills.list.builtin")}>
              <SettingsListItem
                dataAttributes={{ "data-skill-pack": "cocurdex" }}
                isActive={selection?.kind === "pack"}
                subtitle={packSubtitle}
                title={t("skills.pack.title")}
                trailing={packDot ? <SkillStatusDot state={packDot} /> : null}
                onClick={() => onSelect({ kind: "pack" })}
              />
            </SkillGroup>
          )}
          {sections.map((section) => (
            <SkillGroup key={section.id} label={section.label}>
              {section.skills.map((skill) => (
                <SkillRow
                  key={skillKey(skillRef(skill))}
                  selection={selection}
                  skill={skill}
                  onSelect={onSelect}
                />
              ))}
            </SkillGroup>
          ))}
          {sections.length === 0 ? (
            <Text className="px-1" size="body" tone="muted">
              {hasQuery ? t("skills.list.noMatches") : t("skills.list.empty")}
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
