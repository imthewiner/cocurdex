import type { SavedHost } from "@cocurdex/client-runtime";
import type { AgentPlanApprovalOutcome } from "@cocurdex/shared";
import { randomUUID } from "expo-crypto";
import { Stack } from "expo-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { hostConnection } from "@/connection";
import { layout, space, useThemeColors } from "@/theme";
import { Composer } from "./composer";
import { type InteractionActions, InteractionDock } from "./interaction-dock";
import { createSessionDetailStore } from "./session-detail-store";
import { buildTranscript, pendingInteraction } from "./transcript";
import { TranscriptView } from "./transcript-view";

function useSessionDetail(hostId: string, sessionId: string) {
  const [store] = useState(() =>
    createSessionDetailStore(hostConnection(hostId), sessionId),
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

function StatusLine({ text, failed }: { text: string; failed: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={styles.statusLine}>
      {failed ? null : (
        <View style={[styles.ring, { borderColor: colors.brandMark }]} />
      )}
      <Text
        style={[
          styles.statusText,
          { color: failed ? colors.destructive : colors.mutedForeground },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export function SessionDetailScreen({
  host,
  sessionId,
}: {
  host: SavedHost;
  sessionId: string;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const detail = useSessionDetail(host.hostId, sessionId);
  const [actionFailed, setActionFailed] = useState(false);
  const observation = detail.observation;
  const items = useMemo(
    () => (observation ? buildTranscript(observation) : []),
    [observation],
  );
  const pending = observation
    ? pendingInteraction(observation.interactions)
    : null;
  const connection = hostConnection(host.hostId);
  const canInteract = host.scopes.includes("interact");
  const canApprove = host.scopes.includes("approvals");
  const running =
    observation?.session.status === "running" ||
    observation?.activeRun?.status === "running";
  const failed = observation?.session.status === "error";

  const attempt = async (run: () => Promise<unknown>) => {
    setActionFailed(false);
    try {
      await run();
      return true;
    } catch {
      setActionFailed(true);
      return false;
    }
  };

  const actions: InteractionActions = {
    resolvePermission: async (requestId, optionId) => {
      await attempt(() =>
        connection.request("permission.resolve", { requestId, optionId }),
      );
    },
    answerQuestion: async (questionId, answer) => {
      await attempt(() =>
        connection.request("question.resolve", { questionId, answer }),
      );
    },
    resolvePlan: (approvalId, outcome: AgentPlanApprovalOutcome) => {
      void attempt(() =>
        connection.request("planApproval.resolve", {
          approvalId,
          decision: { outcome },
        }),
      );
    },
  };

  const send = (content: string) => {
    const messageId = randomUUID();
    return attempt(() =>
      connection.command(
        "session.send",
        { sessionId, messageId, content },
        { idempotencyKey: messageId },
      ),
    );
  };

  const stop = () => {
    void attempt(() => connection.request("session.stop", { sessionId }));
  };

  const title = observation?.session.title ?? "";
  const status = failed
    ? t("detail.failed")
    : running
      ? t("detail.working")
      : null;

  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitle: false }} />
      <KeyboardAvoidingView
        style={[styles.fill, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        {detail.loaded && detail.missing ? (
          <View style={styles.center}>
            <Text style={{ color: colors.mutedForeground }}>
              {t("detail.missing")}
            </Text>
          </View>
        ) : (
          <TranscriptView
            items={items}
            footer={
              status ? <StatusLine text={status} failed={failed} /> : undefined
            }
          />
        )}
        {actionFailed ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.destructive }]}
          >
            {t("detail.actionFailed")}
          </Text>
        ) : null}
        {pending ? (
          <InteractionDock
            pending={pending}
            canApprove={canApprove}
            actions={actions}
          />
        ) : (
          <Composer
            running={running}
            canSend={canInteract && detail.loaded && !detail.missing}
            onSend={send}
            onStop={stop}
          />
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statusLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.75 },
  statusText: { fontSize: 14 },
  error: {
    fontSize: 13,
    paddingHorizontal: layout.sideMargin,
    paddingBottom: space.xs,
  },
});
