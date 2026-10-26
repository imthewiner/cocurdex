import type { AgentId } from "@cocurdex/shared";
import EditSquareIcon from "@expo/material-symbols/edit_square.xml";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { hostConnection } from "@/connection";
import {
  EmptyHosts,
  HostSwitcher,
  useCurrentHost,
  usePairingRoutes,
} from "@/hosts";
import { beginNewSession, useAgents } from "@/new-session";
import {
  SessionList,
  SessionListViewMenu,
  sessionsStore,
  useHostSessions,
  useSessionListUi,
} from "@/sessions";
import { useSearchBarOptions } from "@/ui";

export default function SessionsScreen() {
  const { t } = useTranslation("sessions");
  const { openPaste, openScan } = usePairingRoutes();
  const router = useRouter();
  const host = useCurrentHost();
  const [query, setQuery] = useState("");
  const searchBarOptions = useSearchBarOptions(t("search"), setQuery);
  if (!host) {
    return <EmptyHosts onScan={() => void openScan()} onPaste={openPaste} />;
  }
  return (
    <HostSessionsScreen
      key={host.hostId}
      host={host}
      query={query}
      searchBarOptions={searchBarOptions}
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
  searchBarOptions,
  onPair,
  onNewSession,
}: {
  host: NonNullable<ReturnType<typeof useCurrentHost>>;
  query: string;
  searchBarOptions: ReturnType<typeof useSearchBarOptions>;
  onPair(): void;
  onNewSession(): void;
}) {
  const { t } = useTranslation("sessions");
  const { view } = useSessionListUi();
  const snapshot = useHostSessions(host.hostId);
  const descriptors = useAgents(host.hostId).data;
  const usedAgents = new Set(snapshot.sessions.map((s) => s.agentType));
  const agentLabels = new Map<AgentId, string>(
    descriptors?.map((agent) => [agent.id, agent.label]),
  );
  const agents = [...usedAgents].map((id) => ({
    id,
    label: agentLabels.get(id) ?? id,
  }));
  const unreadIds = snapshot.attention
    .filter((item) => item.primaryState === "completed-unread")
    .map((item) => item.sessionId);
  const canInteract = host.scopes.includes("interact");
  const markAllRead = async () => {
    const at = new Date().toISOString();
    const connection = hostConnection(host.hostId);
    await Promise.allSettled(
      unreadIds.map((sessionId) =>
        connection.request("attention.update", {
          sessionId,
          action: "visited",
          at,
        }),
      ),
    );
    void sessionsStore(host.hostId).reload();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: searchBarOptions,
        }}
      />
      <HostSwitcher current={host} onPair={onPair} />
      <Stack.Toolbar placement="right">
        <SessionListViewMenu
          view={view}
          agents={agents}
          unreadCount={unreadIds.length}
          onMarkAllRead={canInteract ? () => void markAllRead() : undefined}
        />
        {host.scopes.includes("execute") ? (
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "square.and.pencil" : EditSquareIcon}
            accessibilityLabel={t("newSession.open")}
            onPress={onNewSession}
          />
        ) : null}
      </Stack.Toolbar>
      <SessionList
        host={host}
        query={query}
        agentLabels={agentLabels}
        onReload={() => void sessionsStore(host.hostId).reload()}
      />
    </>
  );
}
