import type { ComponentProps } from "react";
import { TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib";

export function AppPreviewCardTooltipContent({
  className,
  ...props
}: ComponentProps<typeof TooltipContent>) {
  return (
    <TooltipContent
      align="center"
      hideArrow
      side="right"
      sideOffset={8}
      className={cn(
        "min-w-0 max-w-72 flex-col items-stretch gap-1 rounded-card bg-popover px-3 py-2 text-start text-body text-popover-foreground shadow-md ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    />
  );
}
