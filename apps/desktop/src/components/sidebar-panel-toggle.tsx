import { PanelLeft } from "lucide-react";

/**
 * Collapse / expand control for notes & issues sidebars.
 *
 * Layout box is exactly `size-3.5` so it shares a centerline with sibling
 * meta labels (`items-center` + `leading-none`). Hit target grows via an
 * absolute inset so padding never shifts flex alignment.
 *
 * Parent should use the same start inset as the list (`ps-2` /
 * `paddingInlineStart: 8` / row `px-2`).
 */
export function SidebarPanelToggle({
  onClick,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="group relative flex size-3.5 shrink-0 items-center justify-center text-editor-fg-subtle hover:text-editor-fg"
    >
      {/* Hit target only — must not affect the flex layout box. */}
      <span
        aria-hidden
        className="absolute -inset-1.5 rounded-control group-hover:bg-editor-tab-hover-bg"
      />
      <PanelLeft className="relative size-3.5" />
    </button>
  );
}
