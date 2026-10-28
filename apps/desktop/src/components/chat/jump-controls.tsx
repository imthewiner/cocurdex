import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { useTranslation } from "react-i18next";

export function JumpControls({
  streaming = false,
  showJumpToTop,
  showJumpToLatest,
  onJumpToTop,
  onJumpToLatest,
}: {
  streaming?: boolean;
  showJumpToTop: boolean;
  showJumpToLatest: boolean;
  onJumpToTop(): void;
  onJumpToLatest(): void;
}) {
  const { t } = useTranslation(["common", "agent"]);

  if (!showJumpToTop && !showJumpToLatest) {
    return null;
  }

  const jumpControl = showJumpToTop
    ? {
        Icon: ArrowUpToLine,
        label: t("jumpToTop", {
          ns: "common",
          defaultValue: t("agent:jumpToTop"),
        }),
        onJump: onJumpToTop,
      }
    : {
        Icon: ArrowDownToLine,
        label: t("jumpToLatest", {
          ns: "common",
          defaultValue: t("agent:jumpToLatest"),
        }),
        onJump: onJumpToLatest,
      };
  const { Icon, label, onJump } = jumpControl;

  return (
    <div className="pointer-events-none absolute end-4 bottom-4 z-20">
      <button
        aria-label={label}
        className="pointer-events-auto relative flex size-9 cursor-default items-center justify-center rounded-full bg-chat-surface-control text-chat-fg transition-colors hover:bg-chat-surface-control-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={onJump}
        type="button"
      >
        {streaming && showJumpToLatest ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-chat-link/20 motion-reduce:border-chat-link"
          >
            <span
              data-stream-indicator="true"
              className="absolute -inset-0.5 rounded-full border-2 border-transparent border-t-chat-link motion-safe:animate-spin motion-reduce:hidden"
              style={{ animationDuration: "2s" }}
            />
          </span>
        ) : null}
        <Icon className="size-4" />
      </button>
    </div>
  );
}
