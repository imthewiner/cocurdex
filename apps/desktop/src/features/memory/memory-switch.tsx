import { DEFAULT_MEMORY_SETTINGS, type MemoryStatus } from "@cocurdex/shared";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { mutate } from "swr";
import {
  Switch,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn, desktopApi } from "@/lib";
import {
  MEMORY_SETTINGS_KEY,
  MEMORY_STATUS_KEY,
  revalidateMemory,
  useMemoryStatus,
} from "./memory-queries";

function statusLabel(
  t: TFunction<"memory">,
  status:
    | {
        available: boolean;
        installation: string;
        version: string | null;
        error: string | null;
      }
    | undefined,
) {
  if (!status) return t("status.checking");
  if (status.installation === "installing") return t("status.installing");
  if (status.available) {
    return status.version
      ? t("status.ready", { version: status.version })
      : t("status.readyUnknown");
  }
  if (status.installation === "failed") return t("status.failed");
  return t("status.missing");
}

export function MemorySwitch({ className }: { className?: string }) {
  const { t } = useTranslation("memory");
  const { data } = useMemoryStatus();
  const [pending, setPending] = useState(false);
  const enabled = data?.settings.enabled ?? true;
  const installing = data?.installation === "installing";
  const available = data?.available;

  const toggle = async (next: boolean) => {
    setPending(true);
    const settings = data?.settings ?? DEFAULT_MEMORY_SETTINGS;
    const optimistic = { ...settings, enabled: next };
    try {
      await Promise.all([
        mutate(MEMORY_SETTINGS_KEY, optimistic, { revalidate: false }),
        mutate(
          MEMORY_STATUS_KEY,
          (current: MemoryStatus | undefined) =>
            current
              ? { ...current, settings: optimistic, enabled: next }
              : current,
          { revalidate: false },
        ),
      ]);
      const saved = await desktopApi.setMemorySettings(optimistic);
      await mutate(MEMORY_SETTINGS_KEY, saved, { revalidate: false });
      if (next && !available) {
        void desktopApi.installMemory();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("switch.toggleFailed"),
      );
    } finally {
      setPending(false);
      void revalidateMemory().catch(() => undefined);
    }
  };

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 rounded-full", {
                "bg-status-success": available === true,
                "bg-status-warning": installing,
                "bg-destructive": data?.installation === "failed",
                "bg-muted-foreground/40":
                  !installing &&
                  available !== true &&
                  data?.installation !== "failed",
              })}
            />
            <Text as="span" size="meta" tone="muted">
              {t("switch.label")}
            </Text>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          <span className="block max-w-72">
            {statusLabel(t, data)}
            {data?.error ? (
              <span className="mt-1 block opacity-80">{data.error}</span>
            ) : null}
          </span>
        </TooltipContent>
      </Tooltip>
      <Switch
        aria-label={t("switch.label")}
        checked={enabled}
        disabled={pending || installing}
        onCheckedChange={(checked) => void toggle(checked)}
      />
    </div>
  );
}
