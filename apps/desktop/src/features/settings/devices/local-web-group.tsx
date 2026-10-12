import { buildLocalWebClientUrl } from "@cocurdex/shared";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingRow, SettingsGroup } from "@/components/app";
import { Button } from "@/components/ui";
import { desktopApi } from "@/lib";

async function openLocalWebClient() {
  const connection = await desktopApi.getDaemonConnection();
  if (!connection) throw new Error("Daemon is not running");
  await desktopApi.openExternal(
    buildLocalWebClientUrl(connection.webSocketUrl, connection.token),
  );
}

export function LocalWebGroup() {
  const { t } = useTranslation("settings");

  if (!desktopApi.capabilities.localWebClient) return null;

  return (
    <SettingsGroup title={t("devices.localWeb.groupTitle")}>
      <SettingRow
        description={t("devices.localWeb.open.description")}
        title={t("devices.localWeb.open.title")}
      >
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            openLocalWebClient().catch(() => {
              toast.error(t("devices.localWeb.openFailed"));
            });
          }}
        >
          <ExternalLink className="size-3.5" />
          {t("devices.localWeb.open.action")}
        </Button>
      </SettingRow>
    </SettingsGroup>
  );
}
