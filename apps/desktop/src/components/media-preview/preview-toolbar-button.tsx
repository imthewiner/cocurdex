import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib";

export function PreviewToolbarButton({
  children,
  className,
  disabled = false,
  label,
  onClick,
  tooltipSide = "top",
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick(): void;
  tooltipSide?: "bottom" | "top";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <IconButton
            aria-label={label}
            className={cn("text-chat-fg-muted hover:text-chat-fg", className)}
            disabled={disabled}
            onClick={onClick}
            size="xs"
          >
            {children}
          </IconButton>
        }
      />
      <TooltipContent side={tooltipSide} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
