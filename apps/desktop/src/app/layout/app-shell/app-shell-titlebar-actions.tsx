import { PanelRight, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NetworkProxyStatusButton } from "@/features/settings";
import {
  TITLEBAR_ICON_GLYPH_CLASS,
  TitlebarIconButton,
} from "../titlebar-icon-button";

interface AppShellTitlebarActionsProps {
  isChatDetached: boolean;
  isRightPanelOpen: boolean;
  onToggleRightPanel(): void;
  onOpenSettings(): void;
}

export function AppShellTitlebarActions({
  isChatDetached,
  isRightPanelOpen,
  onToggleRightPanel,
  onOpenSettings,
}: AppShellTitlebarActionsProps) {
  const { t } = useTranslation(["editor", "sessions"]);
  const panelLabel = isRightPanelOpen
    ? t("editor:actions.closeEditorPanel")
    : t("editor:actions.openEditorPanel");

  return (
    <>
      {isChatDetached ? null : (
        <TitlebarIconButton
          active={isRightPanelOpen}
          aria-label={panelLabel}
          cursor="default"
          tooltip={panelLabel}
          onClick={onToggleRightPanel}
        >
          <PanelRight className={TITLEBAR_ICON_GLYPH_CLASS} />
        </TitlebarIconButton>
      )}
      <NetworkProxyStatusButton />
      <TitlebarIconButton
        aria-label={t("sessions:sidebar.settings")}
        cursor="default"
        tooltip={t("sessions:sidebar.settings")}
        onClick={onOpenSettings}
      >
        <Settings className={TITLEBAR_ICON_GLYPH_CLASS} />
      </TitlebarIconButton>
    </>
  );
}
