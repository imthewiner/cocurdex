import type { SavedHost } from "@cocurdex/client-runtime";
import ArchiveIcon from "@expo/material-symbols/archive.xml";
import ForkIcon from "@expo/material-symbols/call_split.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import RenameIcon from "@expo/material-symbols/edit.xml";
import PinIcon from "@expo/material-symbols/keep.xml";
import UnpinIcon from "@expo/material-symbols/keep_off.xml";
import MarkUnreadIcon from "@expo/material-symbols/mark_chat_unread.xml";
import { type IconName, Text } from "@expo/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { hostConnection } from "@/connection";
import { useThemeColors } from "@/theme";
import { ListSheet, useConfirm } from "@/ui";
import { reloadArchivedSessions } from "./archived-sessions-queries";
import type { SessionRow } from "./session-sections";
import { sessionsStore } from "./sessions";

type SessionAction =
  | "pin"
  | "unpin"
  | "rename"
  | "markUnread"
  | "fork"
  | "archive"
  | "delete";

const ACTION_ICONS: Record<SessionAction, IconName> = {
  pin: { ios: "pin", android: PinIcon },
  unpin: { ios: "pin.slash", android: UnpinIcon },
  rename: { ios: "pencil", android: RenameIcon },
  markUnread: { ios: "message.badge", android: MarkUnreadIcon },
  fork: { ios: "arrow.triangle.branch", android: ForkIcon },
  archive: { ios: "archivebox", android: ArchiveIcon },
  delete: { ios: "trash", android: DeleteIcon },
};

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
  const router = useRouter();
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
    pin: t("actions.pin"),
    unpin: t("actions.unpin"),
    rename: t("actions.rename"),
    markUnread: t("actions.markUnread"),
    fork: t("actions.fork"),
    archive: t("actions.archive"),
    delete: t("actions.delete"),
  };

  const handlers: Record<SessionAction, () => void> = {
    pin: () =>
      void run((sessionId) =>
        connection.request("session.setPinned", { sessionId, pinned: true }),
      ),
    unpin: () =>
      void run((sessionId) =>
        connection.request("session.setPinned", { sessionId, pinned: false }),
      ),
    rename: () => {
      if (!row) return;
      const sessionId = row.id;
      onDismiss();
      router.push({
        pathname: "/rename-session/[hostId]/[sessionId]",
        params: { hostId: host.hostId, sessionId },
      });
    },
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

  const pinAction: SessionAction[] =
    canInteract && row?.depth === 0 ? [row.pinned ? "unpin" : "pin"] : [];
  const actions: SessionAction[] = [
    ...pinAction,
    ...(canInteract ? (["rename", "markUnread"] as const) : []),
    ...(canExecute ? (["fork"] as const) : []),
    ...(canInteract ? (["archive", "delete"] as const) : []),
  ];

  return (
    <ListSheet
      presented={row !== null}
      title={row?.title ?? ""}
      subtitle={detail}
      items={actions.map((action) => ({
        key: action,
        testID: `session-action-${action}`,
        label: labels[action],
        icon: ACTION_ICONS[action],
        destructive: action === "delete",
        onPress: handlers[action],
      }))}
      footer={
        <>
          {failed ? (
            <Text textStyle={{ color: colors.destructive, fontSize: 13 }}>
              {t("detail.actionFailed")}
            </Text>
          ) : null}
          {dialog}
        </>
      }
      onDismiss={() => {
        setFailed(false);
        onDismiss();
      }}
      testID="session-actions"
    />
  );
}
