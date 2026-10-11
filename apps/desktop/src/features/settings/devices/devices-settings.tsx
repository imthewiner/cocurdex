import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Text } from "@/components/ui";
import {
  AccessLogGroup,
  PairedDevicesGroup,
  PendingPairingsGroup,
} from "./device-lists";
import { PairDeviceDialog } from "./pair-device-dialog";
import { RemoteAccessGroup } from "./remote-access-group";
import { useHostAccess } from "./use-host-access";

export function DevicesSettingsPanel() {
  const { t } = useTranslation("settings");
  const { snapshot, error, refresh } = useHostAccess();
  const [pairing, setPairing] = useState(false);

  if (!snapshot) {
    return error ? (
      <Text size="body" tone="destructive">
        {error}
      </Text>
    ) : null;
  }

  const reload = () => void refresh();

  return (
    <div className="settings-panel-enter flex flex-col gap-8">
      <RemoteAccessGroup
        key={snapshot.remote.settings.port}
        status={snapshot.remote}
        onChanged={reload}
      />
      <PairedDevicesGroup
        action={
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setPairing(true)}
          >
            <Plus className="size-3.5" />
            {t("devices.pair.open")}
          </Button>
        }
        devices={snapshot.devices}
        onChanged={reload}
      />
      <PendingPairingsGroup pairings={snapshot.pairings} onChanged={reload} />
      <AccessLogGroup entries={snapshot.audit} />
      {pairing ? (
        <PairDeviceDialog
          addresses={snapshot.remote.addresses}
          onClose={() => setPairing(false)}
          onCreated={reload}
        />
      ) : null}
    </div>
  );
}
