import type { ReactNode } from "react";
import { cn } from "@/lib";

export function SettingsListItem({
  isActive,
  subtitle,
  title,
  trailing,
  dataAttributes,
  onClick,
}: {
  isActive: boolean;
  subtitle: string;
  title: string;
  trailing?: ReactNode;
  dataAttributes?: Record<`data-${string}`, string>;
  onClick(): void;
}) {
  return (
    <button
      aria-pressed={isActive}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-control border px-3 py-2 text-start transition-colors",
        isActive &&
          "border-primary/40 bg-primary/10 font-medium text-foreground dark:bg-primary/15",
        !isActive &&
          "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/45 hover:text-foreground dark:bg-white/[0.04]",
      )}
      type="button"
      onClick={onClick}
      {...dataAttributes}
    >
      <span className="flex w-full items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-body font-medium">
          {title}
        </span>
        {trailing}
      </span>
      <span className="w-full truncate text-2xs text-muted-foreground/70">
        {subtitle}
      </span>
    </button>
  );
}
