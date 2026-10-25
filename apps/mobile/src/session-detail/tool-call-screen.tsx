import type { AgentToolCallRecord } from "@cocurdex/shared";
import ContentCopyIcon from "@expo/material-symbols/content_copy.xml";
import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import { useSessionDetail } from "./session-detail-stores";
import { SessionTitle } from "./session-title";
import { useToolCallResult } from "./tool-call-queries";
import {
  toolCallDurationMs,
  toolCallInputText,
  toolCallOutputPlaceholder,
  toolCallOutputTail,
  toolCallResultSource,
} from "./tool-call-view";

function statusLabel(
  status: AgentToolCallRecord["status"],
  t: TFunction<"sessions">,
) {
  if (status === "completed") return t("tool.completed");
  if (status === "failed") return t("tool.failed");
  return t("tool.running");
}

function toolCallSubtitle(call: AgentToolCallRecord, t: TFunction<"sessions">) {
  const duration = toolCallDurationMs(call);
  const status = statusLabel(call.status, t);
  if (duration === null) return status;
  const seconds = (duration / 1000).toFixed(1);
  return `${status} · ${t("tool.duration", { seconds })}`;
}

function CodeSection({
  title,
  note,
  text,
  testID,
}: {
  title: string;
  note?: string | null;
  text: string;
  testID: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: colors.mutedForeground }]}
        >
          {title}
        </Text>
        {note ? (
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            {note}
          </Text>
        ) : null}
      </View>
      <View style={[styles.code, { backgroundColor: colors.chatCodePanel }]}>
        <Text
          selectable
          testID={testID}
          style={[styles.codeText, { color: colors.foreground }]}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

export function ToolCallScreen({
  hostId,
  sessionId,
  toolCallId,
}: {
  hostId: string;
  sessionId: string;
  toolCallId: string;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const detail = useSessionDetail(hostId, sessionId);
  const call =
    detail.observation?.toolCalls.find((entry) => entry.id === toolCallId) ??
    null;
  const needsResult = call !== null && call.content === undefined;
  const loaded = useToolCallResult(
    hostId,
    toolCallId,
    needsResult ? `${call.status}:${call.updatedAt}` : null,
  );
  if (!call) return null;
  const input = toolCallInputText(call);
  const output = toolCallOutputTail(toolCallResultSource(call, loaded.data));
  const title = call.title.charAt(0).toUpperCase() + call.title.slice(1);
  const outputText = output?.text ?? null;
  const placeholder = toolCallOutputPlaceholder(needsResult, loaded);
  const placeholderText = {
    loading: "",
    failed: t("tool.outputFailed"),
    none: t("tool.noOutput"),
  }[placeholder];

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => (
            <SessionTitle title={title} subtitle={toolCallSubtitle(call, t)} />
          ),
        }}
      />
      {outputText ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "doc.on.doc" : ContentCopyIcon}
            accessibilityLabel={t("tool.copyOutput")}
            onPress={() => void Clipboard.setStringAsync(outputText)}
          />
        </Stack.Toolbar>
      ) : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {input ? (
          <CodeSection
            title={t("tool.input")}
            text={input}
            testID="tool-call-input"
          />
        ) : null}
        {outputText ? (
          <CodeSection
            title={t("tool.output")}
            note={output?.truncated ? t("tool.outputTail") : null}
            text={outputText}
            testID="tool-call-output"
          />
        ) : (
          <Text
            style={[
              styles.empty,
              {
                color:
                  placeholder === "failed"
                    ? colors.destructive
                    : colors.mutedForeground,
              },
            ]}
          >
            {placeholderText}
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideMargin,
    paddingVertical: space.md,
    gap: space.md,
  },
  section: { gap: space.xs },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 13, fontWeight: "500" },
  note: { fontSize: 12 },
  code: {
    borderRadius: 6,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  codeText: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 12.5,
    lineHeight: 19,
  },
  empty: { fontSize: 15 },
});
