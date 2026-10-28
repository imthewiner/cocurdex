import { DEFAULT_MEMORY_SETTINGS, type MemorySettings } from "@cocurdex/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingRow, SettingsGroup } from "@/components";
import { Button, Input, Spinner, Switch, Text } from "@/components/ui";
import { desktopApi } from "@/lib";
import {
  revalidateMemory,
  useMemorySettings,
  useMemoryStatus,
} from "./memory-queries";

export function MemorySettingsPanel() {
  const { t } = useTranslation("memory");
  const { data: status } = useMemoryStatus();
  const { data: settingsData } = useMemorySettings();
  const settings = settingsData ?? DEFAULT_MEMORY_SETTINGS;
  const [busy, setBusy] = useState(false);
  const installing = status?.installation === "installing";

  const save = async (next: MemorySettings) => {
    try {
      await desktopApi.setMemorySettings(next);
      await revalidateMemory();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings.saveFailed"),
      );
    }
  };

  const runInstall = async () => {
    setBusy(true);
    try {
      const result = await desktopApi.installMemory(true);
      await revalidateMemory();
      if (result.installed) {
        toast.success(t("settings.installReady"));
      } else {
        toast.error(result.message ?? t("settings.installFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings.installFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const runDoctor = async () => {
    setBusy(true);
    try {
      const report = await desktopApi.runMemoryDoctor({ remote: true });
      await revalidateMemory();
      if (report.status === "fail") {
        toast.error(t("settings.doctorFailed"));
      } else {
        toast.success(t("settings.doctorPassed", { status: report.status }));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings.doctorFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup title={t("settings.groupTitle")}>
        <SettingRow
          description={t("settings.enabled.description")}
          title={t("settings.enabled.title")}
        >
          <Switch
            aria-label={t("settings.enabled.title")}
            checked={settings.enabled}
            onCheckedChange={(enabled) => void save({ ...settings, enabled })}
          />
        </SettingRow>
        <SettingRow
          description={t("settings.agentContext.description")}
          title={t("settings.agentContext.title")}
        >
          <Switch
            aria-label={t("settings.agentContext.title")}
            checked={settings.agent.injectContext}
            disabled={!settings.enabled}
            onCheckedChange={(injectContext) =>
              void save({
                ...settings,
                agent: { ...settings.agent, injectContext },
              })
            }
          />
        </SettingRow>
        <SettingRow
          description={t("settings.agentTools.description")}
          title={t("settings.agentTools.title")}
        >
          <Switch
            aria-label={t("settings.agentTools.title")}
            checked={settings.agent.tools}
            disabled={!settings.enabled}
            onCheckedChange={(tools) =>
              void save({ ...settings, agent: { ...settings.agent, tools } })
            }
          />
        </SettingRow>
        <SettingRow
          description={t("settings.chatRecall.description")}
          title={t("settings.chatRecall.title")}
        >
          <Switch
            aria-label={t("settings.chatRecall.title")}
            checked={settings.chat.recall}
            disabled={!settings.enabled}
            onCheckedChange={(recall) =>
              void save({ ...settings, chat: { ...settings.chat, recall } })
            }
          />
        </SettingRow>
        <SettingRow
          description={t("settings.chatSaveTurns.description")}
          title={t("settings.chatSaveTurns.title")}
        >
          <Switch
            aria-label={t("settings.chatSaveTurns.title")}
            checked={settings.chat.saveTurns}
            disabled={!settings.enabled}
            onCheckedChange={(saveTurns) =>
              void save({ ...settings, chat: { ...settings.chat, saveTurns } })
            }
          />
        </SettingRow>
        <SettingRow
          description={t("settings.chatSaveOnEnd.description")}
          title={t("settings.chatSaveOnEnd.title")}
        >
          <Switch
            aria-label={t("settings.chatSaveOnEnd.title")}
            checked={settings.chat.saveOnEnd}
            disabled={!settings.enabled}
            onCheckedChange={(saveOnEnd) =>
              void save({ ...settings, chat: { ...settings.chat, saveOnEnd } })
            }
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={t("settings.connectionTitle")}>
        <div className="flex flex-col gap-3 py-3.5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <Text className="block" size="body" weight="medium">
                {t("settings.status.title")}
              </Text>
              <Text className="mt-0.5 block" size="meta" tone="muted">
                {status?.available
                  ? t("settings.status.available", {
                      version: status.version ?? t("settings.status.unknown"),
                    })
                  : installing
                    ? t("settings.status.installing")
                    : t("settings.status.missing")}
              </Text>
              {status?.executable ? (
                <Text
                  className="mt-1 block break-all font-mono"
                  size="meta"
                  tone="muted"
                >
                  {status.executable}
                </Text>
              ) : null}
              {status?.dataDir ? (
                <Text
                  className="mt-1 block break-all font-mono"
                  size="meta"
                  tone="muted"
                >
                  {status.dataDir}
                </Text>
              ) : null}
              {status?.doctor ? (
                <Text className="mt-1 block" size="meta" tone="muted">
                  {t("settings.status.doctor", {
                    status: status.doctor.status,
                    pass: status.doctor.summary.pass,
                    warn: status.doctor.summary.warn,
                    fail: status.doctor.summary.fail,
                  })}
                </Text>
              ) : null}
              {status?.error ? (
                <Text
                  className="mt-1 block whitespace-pre-wrap"
                  size="meta"
                  tone="muted"
                >
                  {status.error}
                </Text>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {busy || installing ? <Spinner size="md" /> : null}
              <Button
                disabled={busy || installing}
                size="sm"
                variant="outline"
                onClick={() => void runInstall()}
              >
                {status?.available
                  ? t("settings.actions.verify")
                  : t("settings.actions.install")}
              </Button>
              <Button
                disabled={busy || installing || !status?.available}
                size="sm"
                variant="ghost"
                onClick={() => void runDoctor()}
              >
                {t("settings.actions.doctor")}
              </Button>
            </div>
          </div>
        </div>
        <SettingRow
          description={t("settings.cliPath.description")}
          title={t("settings.cliPath.title")}
        >
          <Input
            key={settings.cliPath ?? ""}
            aria-label={t("settings.cliPath.title")}
            className="w-80"
            defaultValue={settings.cliPath ?? ""}
            placeholder={t("settings.cliPath.placeholder")}
            onBlur={(event) => {
              const next = event.target.value.trim() || null;
              if (next !== settings.cliPath) {
                void save({ ...settings, cliPath: next });
              }
            }}
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
