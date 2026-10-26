import type { SavedHost } from "@cocurdex/client-runtime";
import type {
  AgentPlanApprovalOutcome,
  ImageAttachment,
  SessionObservationSnapshot,
  WorkspaceRecord,
} from "@cocurdex/shared";
import { randomUUID } from "expo-crypto";
import { router, Stack } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hostConnection } from "@/connection";
import { useViewedSession } from "@/sessions";
import { layout, space, useThemeColors } from "@/theme";
import { ShimmerText } from "@/ui";
import { Composer } from "./composer";
import {
  imageAttachmentSource,
  pickImages,
  uploadImage,
} from "./image-attachments";
import { type InteractionActions, InteractionDock } from "./interaction-dock";
import { useSessionDetail } from "./session-detail-stores";
import { SessionTitle } from "./session-title";
import { sessionWorkspace, sessionWorkspacePath } from "./session-workspace";
import { buildTranscript, pendingInteraction } from "./transcript";
import { type CondensedItem, condenseTranscript } from "./transcript-activity";
import { TranscriptView } from "./transcript-view";

function sessionSubtitle(
  observation: SessionObservationSnapshot | null,
  workspace: WorkspaceRecord | null,
) {
  const model = observation?.session.providerSnapshot?.modelName;
  const parts = [workspace?.name, model].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function StatusLine({ text, failed }: { text: string; failed: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={styles.statusLine} accessibilityLiveRegion="polite">
      {failed ? (
        <Text style={[styles.statusText, { color: colors.destructive }]}>
          {text}
        </Text>
      ) : (
        <ShimmerText
          text={text}
          baseColor={colors.mutedForeground}
          highlightColor={colors.foreground}
          style={styles.statusText}
          testID="session-running-status"
        />
      )}
    </View>
  );
}

type LivePhase = "thinking" | "usingTools" | "responding";

function livePhase(items: readonly CondensedItem[]): LivePhase {
  const last = items.at(-1);
  if (last?.kind === "assistant" && last.streaming) return "responding";
  const tools =
    last?.kind === "activity"
      ? last.items
      : last?.kind === "tool"
        ? [last]
        : [];
  const active = tools.some(
    (item) =>
      item.kind === "tool" &&
      (item.status === "pending" || item.status === "in_progress"),
  );
  return active ? "usingTools" : "thinking";
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
  const headerHeight = useHeaderHeight();
  const bottomInset = Math.max(useSafeAreaInsets().bottom - space.sm, 0);
  const detail = useSessionDetail(host.hostId, sessionId);
  const [actionFailed, setActionFailed] = useState(false);
  const observation = detail.observation;
  const viewed = useViewedSession(host.hostId, sessionId);
  const workspaces = viewed.workspaces;
  const listed = viewed.sessions.find((entry) => entry.id === sessionId);
  const workspace = sessionWorkspace(observation, workspaces);
  const workspacePath = sessionWorkspacePath(observation, workspace);
  const running =
    observation?.session.status === "running" ||
    observation?.activeRun?.status === "running";
  const items = useMemo(
    () =>
      observation
        ? condenseTranscript(
            buildTranscript({ ...observation, workspacePath }),
            observation.toolCalls,
            running,
          )
        : [],
    [observation, workspacePath, running],
  );
  const pending = observation
    ? pendingInteraction(observation.interactions)
    : null;
  const connection = hostConnection(host.hostId);
  const canInteract = host.scopes.includes("interact");
  const canApprove = host.scopes.includes("approvals");
  const canFork = host.scopes.includes("execute");
  const canReadFiles = host.scopes.includes("files.read");
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

  const send = (content: string, attachments: ImageAttachment[]) => {
    const messageId = randomUUID();
    return attempt(() =>
      connection.command(
        "session.send",
        { sessionId, messageId, content, attachments },
        { idempotencyKey: messageId },
      ),
    );
  };

  const fork = (throughMessageId: string) => {
    void attempt(async () => {
      const forked = await connection.request("session.fork", {
        sessionId,
        throughMessageId,
        title: t("message.forkTitle", { title }),
      });
      router.push({
        pathname: "/session/[hostId]/[sessionId]",
        params: { hostId: host.hostId, sessionId: forked.id },
      });
    });
  };

  const stop = () => {
    void attempt(() => connection.request("session.stop", { sessionId }));
  };

  const title = observation?.session.title ?? listed?.title ?? "";
  const liveLabels: Record<LivePhase, string> = {
    thinking: t("detail.thinking"),
    usingTools: t("detail.usingTools"),
    responding: t("detail.responding"),
  };
  const runningStatus = running ? liveLabels[livePhase(items)] : null;
  const status = failed ? t("detail.failed") : runningStatus;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitle: false,
          headerTitle: () => (
            <SessionTitle
              title={title}
              subtitle={sessionSubtitle(observation, workspace)}
            />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.fill, { backgroundColor: colors.background }]}
        behavior="padding"
        keyboardVerticalOffset={headerHeight - bottomInset}
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
            actions={{
              hostId: host.hostId,
              fileRoot: canReadFiles ? workspacePath : undefined,
              imageSource: (attachment) =>
                imageAttachmentSource(host, attachment),
              onOpenImage: (attachment) =>
                router.push({
                  pathname: "/image/[hostId]",
                  params: {
                    hostId: host.hostId,
                    filePath: attachment.filePath,
                    name: attachment.name,
                  },
                }),
              onFork: canFork ? fork : null,
              onOpenTool: (toolCallId) =>
                router.push({
                  pathname: "/tool-call/[hostId]/[sessionId]/[toolCallId]",
                  params: { hostId: host.hostId, sessionId, toolCallId },
                }),
            }}
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
        <View style={{ paddingBottom: bottomInset }}>
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
              onPickImages={pickImages}
              onUploadImage={(image) => uploadImage(host, image)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statusLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  statusText: { fontSize: 14 },
  error: {
    fontSize: 13,
    paddingHorizontal: layout.sideMargin,
    paddingBottom: space.xs,
  },
});
