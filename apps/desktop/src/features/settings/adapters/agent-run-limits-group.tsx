import {
  AGENT_RUN_LIMIT_BOUNDS,
  type AgentRunLimits,
  parseAgentRunLimits,
} from "@cocurdex/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingRow, SettingsGroup } from "@/components/app";
import { Input } from "@/components/ui";
import { desktopApi, useMountEffect } from "@/lib";

type RunLimitField = keyof AgentRunLimits;

type RunLimitDrafts = Record<RunLimitField, string>;

const EMPTY_DRAFTS: RunLimitDrafts = {
  maxConcurrentRuns: "",
  maxConcurrentRunsPerAgent: "",
  delegatedRunTimeoutMinutes: "",
};

function draftsFrom(limits: AgentRunLimits): RunLimitDrafts {
  return {
    maxConcurrentRuns: String(limits.maxConcurrentRuns),
    maxConcurrentRunsPerAgent: String(limits.maxConcurrentRunsPerAgent),
    delegatedRunTimeoutMinutes:
      limits.delegatedRunTimeoutMinutes === null
        ? ""
        : String(limits.delegatedRunTimeoutMinutes),
  };
}

function limitsFrom(drafts: RunLimitDrafts): AgentRunLimits | null {
  const timeout = drafts.delegatedRunTimeoutMinutes.trim();
  return parseAgentRunLimits({
    maxConcurrentRuns: Number(drafts.maxConcurrentRuns),
    maxConcurrentRunsPerAgent: Number(drafts.maxConcurrentRunsPerAgent),
    delegatedRunTimeoutMinutes: timeout === "" ? null : Number(timeout),
  });
}

function RunLimitInput({
  disabled,
  field,
  onChange,
  onCommit,
  placeholder,
  value,
}: {
  disabled: boolean;
  field: RunLimitField;
  onChange: (field: RunLimitField, value: string) => void;
  onCommit: () => void;
  placeholder?: string;
  value: string;
}) {
  const bounds = AGENT_RUN_LIMIT_BOUNDS[field];
  return (
    <Input
      className="w-24"
      disabled={disabled}
      max={bounds.max}
      min={bounds.min}
      onBlur={onCommit}
      onChange={(event) => onChange(field, event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit();
      }}
      placeholder={placeholder}
      step={1}
      type="number"
      value={value}
    />
  );
}

export function AgentRunLimitsGroup() {
  const { t } = useTranslation("settings");
  const [saved, setSaved] = useState<AgentRunLimits | null>(null);
  const [drafts, setDrafts] = useState<RunLimitDrafts | null>(null);

  useMountEffect(() => {
    void desktopApi.getAgentRunLimits().then((limits) => {
      setSaved(limits);
      setDrafts(draftsFrom(limits));
    });
  });

  const change = (field: RunLimitField, value: string) => {
    setDrafts((current) =>
      current ? { ...current, [field]: value } : current,
    );
  };

  const commit = async () => {
    if (!drafts || !saved) return;
    const next = limitsFrom(drafts);
    if (!next) {
      toast.error(t("adapters.runLimits.invalid"));
      setDrafts(draftsFrom(saved));
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(saved)) return;
    try {
      const stored = await desktopApi.setAgentRunLimits(next);
      setSaved(stored);
      setDrafts(draftsFrom(stored));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("adapters.runLimits.saveFailed"),
      );
      setDrafts(draftsFrom(saved));
    }
  };

  const disabled = drafts === null;
  const values = drafts ?? EMPTY_DRAFTS;

  return (
    <SettingsGroup
      description={t("adapters.runLimits.description")}
      title={t("adapters.runLimits.title")}
    >
      <SettingRow
        description={t("adapters.runLimits.maxConcurrentRuns.description")}
        title={t("adapters.runLimits.maxConcurrentRuns.title")}
      >
        <RunLimitInput
          disabled={disabled}
          field="maxConcurrentRuns"
          onChange={change}
          onCommit={() => void commit()}
          value={values.maxConcurrentRuns}
        />
      </SettingRow>
      <SettingRow
        description={t(
          "adapters.runLimits.maxConcurrentRunsPerAgent.description",
        )}
        title={t("adapters.runLimits.maxConcurrentRunsPerAgent.title")}
      >
        <RunLimitInput
          disabled={disabled}
          field="maxConcurrentRunsPerAgent"
          onChange={change}
          onCommit={() => void commit()}
          value={values.maxConcurrentRunsPerAgent}
        />
      </SettingRow>
      <SettingRow
        description={t("adapters.runLimits.timeout.description")}
        title={t("adapters.runLimits.timeout.title")}
      >
        <RunLimitInput
          disabled={disabled}
          field="delegatedRunTimeoutMinutes"
          onChange={change}
          onCommit={() => void commit()}
          placeholder={t("adapters.runLimits.timeout.none")}
          value={values.delegatedRunTimeoutMinutes}
        />
      </SettingRow>
    </SettingsGroup>
  );
}
