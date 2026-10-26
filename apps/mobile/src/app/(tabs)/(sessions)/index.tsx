import { type AgentId, countActiveSessionFilters } from "@cocurdex/shared";
import EditSquareIcon from "@expo/material-symbols/edit_square.xml";
import FilterIcon from "@expo/material-symbols/filter_list.xml";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import {
  EmptyHosts,
  HostSwitcher,
  useCurrentHost,
  usePairingRoutes,
  useScopeGate,
} from "@/hosts";
import { beginNewSession, useAgents } from "@/new-session";
import { SessionList, sessionsStore, useSessionListUi } from "@/sessions";
import { emptyListOptions, type ListHeader, useListHeader } from "@/ui";

function filterIcon(filtered: boolean) {
  if (Platform.OS !== "ios") return FilterIcon;
  return filtered
    ? "line.3.horizontal.decrease.circle.fill"
    : "line.3.horizontal.decrease.circle";
}

export default function SessionsScreen() {
  const { t } = useTranslation(["sessions", "common"]);
  const { openPaste, openScan } = usePairingRoutes();
  const router = useRouter();
  const host = useCurrentHost();
  const [query, setQuery] = useState("");
  const listHeader = useListHeader(t("common:screens.sessions"), {
    placeholder: t("search"),
    onQuery: setQuery,
  });
  if (!host) {
    return (
      <>
        <Stack.Screen
          options={emptyListOptions(t("common:screens.sessions"))}
        />
        <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />
      </>
    );
  }
  return (
    <HostSessionsScreen
      key={host.hostId}
      host={host}
      query={query}
      listHeader={listHeader}
      onPair={openPaste}
      onNewSession={() => {
        beginNewSession(host.hostId);
        router.push("/new-session");
      }}
    />
  );
}

function HostSessionsScreen({
  host,
  query,
  listHeader,
  onPair,
  onNewSession,
}: {
  host: NonNullable<ReturnType<typeof useCurrentHost>>;
  query: string;
  listHeader: ListHeader;
  onPair(): void;
  onNewSession(): void;
}) {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const { view } = useSessionListUi();
  const filtered = countActiveSessionFilters(view) > 0;
  const descriptors = useAgents(host.hostId).data;
  const agentLabels = new Map<AgentId, string>(
    descriptors?.map((agent) => [agent.id, agent.label]),
  );
  const gate = useScopeGate(host);

  return (
    <>
      <Stack.Screen options={listHeader.options} />
      <HostSwitcher current={host} onPair={onPair} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={filterIcon(filtered)}
          accessibilityLabel={t("list.menu")}
          onPress={() => router.push("/list-options")}
        >
          {filtered ? <Stack.Toolbar.Badge /> : null}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "square.and.pencil" : EditSquareIcon}
          accessibilityLabel={t("newSession.open")}
          onPress={gate("execute", onNewSession)}
        />
      </Stack.Toolbar>
      <SessionList
        host={host}
        query={query}
        agentLabels={agentLabels}
        onReload={() => void sessionsStore(host.hostId).reload()}
        header={listHeader.header}
      />
    </>
  );
}
