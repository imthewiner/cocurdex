import type { InstalledSkill, ProductSkillScope } from "@cocurdex/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsGroup } from "@/components";
import { Button, Spinner, Text } from "@/components/ui";
import { desktopApi } from "@/lib";
import type { ProductSkillsStatus } from "@/lib/types";
import type { SkillPackState } from "./use-skill-pack";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function usePackStatusText(status: ProductSkillsStatus | undefined) {
  const { t } = useTranslation("settings");
  if (!status) {
    return "";
  }
  if (status.conflict) {
    return t("skills.status.conflict", {
      skills: status.conflictSkills.join(", "),
      path: status.agentsSkillsDir,
    });
  }
  if (status.installed && status.updateAvailable) {
    return t("skills.status.updateAvailable", {
      installed: status.installedVersion ?? status.packVersion,
      latest: status.packVersion,
      path: status.agentsSkillsDir,
    });
  }
  if (status.installed) {
    return t("skills.status.installed", {
      version: status.installedVersion ?? status.packVersion,
      path: status.agentsSkillsDir,
    });
  }
  return t("skills.status.notInstalled", { path: status.agentsSkillsDir });
}

function PackScopeRow({
  pack,
  scope,
  onChanged,
}: {
  pack: SkillPackState;
  scope: ProductSkillScope;
  onChanged(): void;
}) {
  const { t } = useTranslation("settings");
  const [busy, setBusy] = useState(false);
  const status = pack.statuses[scope];
  const statusText = usePackStatusText(status);
  const rootPath = scope === "project" ? pack.workspaceRootPath : null;

  const install = async () => {
    setBusy(true);
    try {
      const result = await desktopApi.installProductSkills(scope, rootPath);
      pack.setStatus(scope, result);
      onChanged();
      if (result.action === "conflict") {
        toast.error(
          t("skills.toast.conflict", {
            skills: result.conflictSkills.join(", "),
          }),
        );
      } else {
        toast.success(t(`skills.toast.${result.action}`));
      }
    } catch (error) {
      toast.error(errorMessage(error, t("skills.toast.installFailed")));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await desktopApi.removeProductSkills(scope, rootPath);
      await pack.refresh();
      onChanged();
      toast.success(t("skills.toast.removed"));
    } catch (error) {
      toast.error(errorMessage(error, t("skills.toast.removeFailed")));
    } finally {
      setBusy(false);
    }
  };

  let installLabel: string = t("skills.actions.install");
  if (status?.installed && status.updateAvailable) {
    installLabel = t("skills.actions.update");
  } else if (status?.installed) {
    installLabel = t("skills.actions.reinstall");
  }
  const canInstall =
    Boolean(status?.sourceAvailable) && !status?.conflict && !busy;
  const canRemove = Boolean(status?.installed || status?.managed) && !busy;

  return (
    <div
      className="flex items-center justify-between gap-6 py-3.5"
      data-skill-pack-scope={scope}
    >
      <div className="min-w-0 flex-1">
        <Text as="div" size="body" weight="medium">
          {t(`skills.scope.${scope}.title`)}
        </Text>
        <Text as="div" className="mt-0.5 break-all" size="meta" tone="muted">
          {statusText}
        </Text>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {busy ? <Spinner size="sm" /> : null}
        <Button
          disabled={!canInstall}
          size="sm"
          variant="outline"
          onClick={() => void install()}
        >
          {installLabel}
        </Button>
        <Button
          disabled={!canRemove}
          size="sm"
          variant="ghost"
          onClick={() => void remove()}
        >
          {t("skills.actions.remove")}
        </Button>
      </div>
    </div>
  );
}

export function SkillPackDetail({
  builtin,
  pack,
  onChanged,
}: {
  builtin: InstalledSkill[];
  pack: SkillPackState;
  onChanged(): void;
}) {
  const { t } = useTranslation("settings");
  const names =
    pack.statuses.global?.skills ?? builtin.map((skill) => skill.name);
  const descriptions = new Map(
    builtin.map((skill) => [skill.name, skill.description]),
  );
  const scopes: ProductSkillScope[] = pack.workspaceRootPath
    ? ["global", "project"]
    : ["global"];

  return (
    <section
      aria-label={t("skills.pack.title")}
      className="flex flex-col gap-6"
      data-skill-detail="cocurdex"
    >
      <div className="flex flex-col gap-1">
        <Text as="h2" size="display" weight="semibold">
          {t("skills.pack.title")}
        </Text>
        <Text size="body" tone="muted">
          {t("skills.intro")}
        </Text>
      </div>
      <SettingsGroup title={t("skills.groupTitle")}>
        {scopes.map((scope) => (
          <PackScopeRow
            key={scope}
            pack={pack}
            scope={scope}
            onChanged={onChanged}
          />
        ))}
      </SettingsGroup>
      <SettingsGroup title={t("skills.pack.included", { count: names.length })}>
        {names.map((name) => (
          <div className="py-3" key={name}>
            <Text as="div" className="font-mono" size="body" weight="medium">
              {name}
            </Text>
            {descriptions.get(name) ? (
              <Text as="div" className="mt-0.5" size="meta" tone="muted">
                {descriptions.get(name)}
              </Text>
            ) : null}
          </div>
        ))}
      </SettingsGroup>
    </section>
  );
}
