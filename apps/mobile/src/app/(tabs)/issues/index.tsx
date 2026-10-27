import type { SavedHost } from "@cocurdex/client-runtime";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EmptyHosts,
  useCurrentHost,
  usePairingRoutes,
  useScopeGate,
} from "@/hosts";
import { IssueList, WorkspaceChips } from "@/issues";
import { ListScreenHeader } from "@/ui";

export default function IssuesScreen() {
  const { t } = useTranslation();
  const { openPaste, openScan } = usePairingRoutes();
  const host = useCurrentHost();
  if (!host) {
    return (
      <>
        <ListScreenHeader title={t("screens.issues")} />
        <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />
      </>
    );
  }
  return <HostIssues host={host} />;
}

function HostIssues({ host }: { host: SavedHost }) {
  const { t } = useTranslation(["issues", "common"]);
  const router = useRouter();
  const gate = useScopeGate(host);
  const [query, setQuery] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  return (
    <>
      <ListScreenHeader
        title={t("common:screens.issues")}
        search={{ placeholder: t("search"), onQuery: setQuery }}
        actions={[
          {
            key: "new",
            icon: { ios: "plus", android: "add" },
            label: t("create.open"),
            onPress: gate("interact", () =>
              router.push({
                pathname: "/new-issue/[hostId]",
                params: workspaceId
                  ? { hostId: host.hostId, workspaceId }
                  : { hostId: host.hostId },
              }),
            ),
          },
        ]}
      />
      <IssueList
        host={host}
        workspaceId={workspaceId}
        query={query}
        header={
          <WorkspaceChips
            host={host}
            workspaceId={workspaceId}
            onChange={setWorkspaceId}
          />
        }
      />
    </>
  );
}
