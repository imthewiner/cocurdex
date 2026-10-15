import { useRef, useState } from "react";
import {
  SidebarListRowLabel,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";

export function NoteTitleButton({
  title,
  onOpen,
  onStartRename,
}: {
  title: string;
  onOpen: () => void;
  onStartRename: () => void;
}) {
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Tooltip
      open={tooltipOpen}
      onOpenChange={(open) => {
        const label = labelRef.current;
        setTooltipOpen(
          open && label !== null && label.scrollWidth > label.clientWidth,
        );
      }}
      disableHoverablePopup
    >
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex h-6 min-w-0 flex-1 items-center overflow-hidden text-start"
          onClick={onOpen}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onStartRename();
          }}
        >
          <SidebarListRowLabel ref={labelRef}>{title}</SidebarListRowLabel>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {title}
      </TooltipContent>
    </Tooltip>
  );
}
