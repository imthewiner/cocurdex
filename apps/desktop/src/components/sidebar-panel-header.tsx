import type { ReactNode } from "react";
import { Text } from "@/components/ui";
import { cn } from "@/lib";
import { SidebarPanelToggle } from "./sidebar-panel-toggle";

export const WORKBENCH_SIDEBAR_WIDTH_PX = 220;

export function SidebarPanelHeader({
  title,
  collapseLabel,
  onCollapse,
  action,
  divided = false,
}: {
  title: string;
  collapseLabel: string;
  onCollapse: () => void;
  action?: ReactNode;
  divided?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center justify-between gap-1",
        !divided && "px-2",
        divided && "-mx-2 border-b border-editor-border px-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <SidebarPanelToggle onClick={onCollapse} aria-label={collapseLabel} />
        <Text
          size="meta"
          weight="medium"
          className="truncate leading-none text-editor-fg-subtle"
        >
          {title}
        </Text>
      </div>
      {action}
    </div>
  );
}
