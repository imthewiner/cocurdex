import { ArrowLeft, PanelLeft } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { ResizeSeparator } from "@/components/resize-separator";
import { cn } from "@/lib";
import {
  TITLEBAR_ICON_GLYPH_CLASS,
  TitlebarIconButton,
} from "../titlebar-icon-button";

export { ResizeSeparator } from "@/components/resize-separator";
export { TitlebarButton, TitlebarIconButton } from "../titlebar-icon-button";

export function ScreenBackButton({
  canGoBack,
  label,
  onGoBack,
}: {
  canGoBack: boolean;
  label: string;
  onGoBack(): void;
}) {
  return (
    <TitlebarIconButton
      aria-label={label}
      disabled={!canGoBack}
      tooltip={label}
      onClick={onGoBack}
    >
      <ArrowLeft
        className={cn(TITLEBAR_ICON_GLYPH_CLASS, "rtl:-scale-x-100")}
      />
    </TitlebarIconButton>
  );
}

export function SidebarToggleButton({
  ariaLabel,
  className,
  onToggle,
}: {
  ariaLabel: string;
  className?: string;
  onToggle(): void;
}) {
  return (
    <TitlebarIconButton
      aria-label={ariaLabel}
      className={className}
      tooltip={ariaLabel}
      onClick={onToggle}
    >
      <PanelLeft className={TITLEBAR_ICON_GLYPH_CLASS} />
    </TitlebarIconButton>
  );
}

export function ResizableSidebarSlot({
  children,
  isOpen,
  separatorAriaLabel,
  width,
  onResizeMouseDown,
}: {
  children: ReactNode;
  isOpen: boolean;
  separatorAriaLabel?: string;
  width: number;
  onResizeMouseDown(event: MouseEvent): void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="shrink-0" style={{ width }}>
        {children}
      </div>
      <ResizeSeparator
        ariaLabel={separatorAriaLabel}
        onMouseDown={onResizeMouseDown}
      />
    </>
  );
}
