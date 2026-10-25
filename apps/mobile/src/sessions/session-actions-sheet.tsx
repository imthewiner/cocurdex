import type { SavedHost } from "@cocurdex/client-runtime";
import ArchiveIcon from "@expo/material-symbols/archive.xml";
import ForkIcon from "@expo/material-symbols/call_split.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import MarkUnreadIcon from "@expo/material-symbols/mark_chat_unread.xml";
import { BottomSheet, Column, Icon, type IconName, Text } from "@expo/ui";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { hostConnection } from "@/connection";
import { space, useThemeColors } from "@/theme";
import { SHEET_TITLE_INSET, SheetRow, useConfirm } from "@/ui";
import { reloadArchivedSessions } from "./archived-sessions-queries";
import type { SessionRow } from "./session-sections";
import { sessionsStore } from "./sessions";

type SessionAction = "markUnread" | "fork" | "archive" | "delete";

const ACTION_ICONS: Record<SessionAction, IconName> = {
  markUnread: { ios: "message.badge", android: MarkUnreadIcon },
  fork: { ios: "arrow.triangle.branch", android: ForkIcon },
  archive: { ios: "archivebox", android: ArchiveIcon },
  delete: { ios: "trash", android: DeleteIcon },
};

function ActionRow({
  action,
  label,
  onPress,
}: {
  action: SessionAction;
  label: string;
  onPress(): void;
}) {
  const colors = useThemeColors();
  const color = action === "delete" ? colors.destructive : colors.foreground;
  return (
    <SheetRow
      testID={`session-action-${action}`}
      label={label}
      color={color}
      onPress={onPress}
      leading={<Icon name={ACTION_ICONS[action]} size={22} color={color} />}
    />
  );
}

export function SessionActionsSheet({
  host,
  row,
  detail,
  onDismiss,
}: {
  host: SavedHost;
  row: SessionRow | null;
  detail: string | null;
  onDismiss(): void;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const { confirm, dialog } = useConfirm();
  const canExecute = host.scopes.includes("execute");
  const canInteract = host.scopes.includes("interact");
  const connection = hostConnection(host.hostId);

  const run = async (work: (sessionId: string) => Promise<unknown>) => {
    if (!row) return;
    setFailed(false);
    try {
      await work(row.id);
      onDismiss();
      void sessionsStore(host.hostId).reload();
      void reloadArchivedSessions(host.hostId);
    } catch {
      setFailed(true);
    }
  };

  const labels: Record<SessionAction, string> = {
    markUnread: t("actions.markUnread"),
    fork: t("actions.fork"),
    archive: t("actions.archive"),
    delete: t("actions.delete"),
  };

  const handlers: Record<SessionAction, () => void> = {
    markUnread: () =>
      void run((sessionId) =>
        connection.request("attention.update", {
          sessionId,
          action: "mark-unread",
          at: new Date().toISOString(),
        }),
      ),
    fork: () =>
      void run(async (sessionId) => {
        const fork = await connection.request("session.fork", {
          sessionId,
          title: t("message.forkTitle", { title: row?.title ?? "" }),
        });
        router.push({
          pathname: "/session/[hostId]/[sessionId]",
          params: { hostId: host.hostId, sessionId: fork.id },
        });
      }),
    archive: () =>
      void run((sessionId) =>
        connection.request("session.archive", { sessionId }),
      ),
    delete: () =>
      confirm({
        title: t("actions.deleteTitle", { title: row?.title ?? "" }),
        message: t("actions.deleteMessage"),
        cancelLabel: t("actions.cancel"),
        confirmLabel: t("actions.delete"),
        destructive: true,
        onConfirm: () =>
          void run((sessionId) =>
            connection.request("session.delete", { sessionId }),
          ),
      }),
  };

  const actions: SessionAction[] = [
    ...(canInteract ? (["markUnread"] as const) : []),
    ...(canExecute ? (["fork"] as const) : []),
    ...(canInteract ? (["archive", "delete"] as const) : []),
  ];

  return (
    <BottomSheet
      isPresented={row !== null}
      onDismiss={() => {
        setFailed(false);
        onDismiss();
      }}
      containerColor={colors.background}
      testID="session-actions"
    >
      {row ? (
        <Column spacing={space.xs}>
          <Column spacing={2} style={{ paddingHorizontal: SHEET_TITLE_INSET }}>
            <Text
              numberOfLines={2}
              textStyle={{
                color: colors.foreground,
                fontSize: 17,
                fontWeight: "600",
              }}
            >
              {row.title}
            </Text>
            {detail ? (
              <Text
                numberOfLines={1}
                textStyle={{ color: colors.mutedForeground, fontSize: 13 }}
              >
                {detail}
              </Text>
            ) : null}
          </Column>
          {actions.map((action) => (
            <ActionRow
              key={action}
              action={action}
              label={labels[action]}
              onPress={handlers[action]}
            />
          ))}
          {failed ? (
            <Text textStyle={{ color: colors.destructive, fontSize: 13 }}>
              {t("detail.actionFailed")}
            </Text>
          ) : null}
          {dialog}
        </Column>
      ) : null}
    </BottomSheet>
  );
}
