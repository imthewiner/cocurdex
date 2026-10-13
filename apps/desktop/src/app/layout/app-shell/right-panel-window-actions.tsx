import { useAtom } from "jotai";
import { Maximize2, Minimize2, Pin, PinOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { rightPanelDockedAtom } from "../right-editor-panel-store";
import {
  TITLEBAR_ICON_GLYPH_CLASS,
  TitlebarIconButton,
} from "../titlebar-icon-button";

interface RightPanelWindowActionsProps {
  isRightPanelMaximized: boolean;
  onToggleRightPanelMaximize(): void;
  onCloseRightPanel(): void;
}

export function RightPanelWindowActions({
  isRightPanelMaximized,
  onToggleRightPanelMaximize,
  onCloseRightPanel,
}: RightPanelWindowActionsProps) {
  const { t } = useTranslation("editor");
  const [isRightPanelDocked, setRightPanelDocked] =
    useAtom(rightPanelDockedAtom);
  const maximizeLabel = isRightPanelMaximized
    ? t("actions.exitEditorFullscreen")
    : t("actions.enterEditorFullscreen");
  const closeLabel = t("actions.closeEditorPanel");
  const dockLabel = isRightPanelDocked
    ? t("actions.floatEditorPanel")
    : t("actions.dockEditorPanel");

  return (
    <div className="app-no-drag flex items-center gap-1">
      {isRightPanelMaximized ? null : (
        <TitlebarIconButton
          active={isRightPanelDocked}
          aria-label={dockLabel}
          cursor="default"
          tooltip={dockLabel}
          onClick={() => setRightPanelDocked(!isRightPanelDocked)}
        >
          {isRightPanelDocked ? (
            <PinOff className={TITLEBAR_ICON_GLYPH_CLASS} />
          ) : (
            <Pin className={TITLEBAR_ICON_GLYPH_CLASS} />
          )}
        </TitlebarIconButton>
      )}
      <TitlebarIconButton
        active={isRightPanelMaximized}
        aria-label={maximizeLabel}
        cursor="default"
        tooltip={maximizeLabel}
        onClick={onToggleRightPanelMaximize}
      >
        {isRightPanelMaximized ? (
          <Minimize2 className={TITLEBAR_ICON_GLYPH_CLASS} />
        ) : (
          <Maximize2 className={TITLEBAR_ICON_GLYPH_CLASS} />
        )}
      </TitlebarIconButton>
      <TitlebarIconButton
        aria-label={closeLabel}
        cursor="default"
        tooltip={closeLabel}
        onClick={onCloseRightPanel}
      >
        <X className={TITLEBAR_ICON_GLYPH_CLASS} />
      </TitlebarIconButton>
    </div>
  );
}
