import type { AgentThinkingLevel, SessionRecord } from "@cocurdex/shared";
import { createProviderSnapshotForModel } from "@cocurdex/shared";
import { useAtomValue } from "jotai";
import { Brain } from "lucide-react";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  ChatView,
  toolCallsBySessionAtom,
  useSessionMessages,
} from "@/features/agent";
import {
  ChatContextMeter,
  chatProviderModelsAtom,
  getChatThinkingLevelOptions,
  ModelPicker,
  resolveChatThinkingLevel,
} from "@/features/chat";
import type { ChatComposerHandle } from "@/features/composer";
import {
  getAgentDisplayLabel,
  getDisplaySessionStatus,
} from "@/features/sessions";
import { desktopApi } from "@/lib";
import { useChatSessionActions } from "./use-chat-session-actions";

interface ChatSessionPanelProps {
  session: SessionRecord;
  composerRef?: Ref<ChatComposerHandle>;
  paneId?: string;
}

function notifyFailure(error: unknown) {
  toast.error(error instanceof Error ? error.message : String(error));
}

export function ChatSessionPanel({
  session,
  composerRef,
  paneId,
}: ChatSessionPanelProps) {
  const { t } = useTranslation("memory");
  const [savingMemory, setSavingMemory] = useState(false);
  const messages = useSessionMessages(session.id);
  const toolCalls = useAtomValue(toolCallsBySessionAtom)[session.id] ?? [];
  const compatibleModels = useAtomValue(chatProviderModelsAtom);
  const actions = useChatSessionActions(paneId);
  const snapshot = session.providerSnapshot ?? null;
  const status = getDisplaySessionStatus(session.status, messages);
  const isRunning = status === "running";
  const thinkingLevelOptions = getChatThinkingLevelOptions(snapshot);
  const thinkingLevel = resolveChatThinkingLevel(
    thinkingLevelOptions,
    snapshot?.thinkingLevel,
    "off",
  );

  const changeModel = (providerId: string, modelId: string) => {
    const selected = compatibleModels.find(
      ({ model }) =>
        model.providerId === providerId && model.modelId === modelId,
    );
    if (!selected) return;
    const next = createProviderSnapshotForModel(selected);
    const nextThinking = resolveChatThinkingLevel(
      getChatThinkingLevelOptions(next),
      thinkingLevel,
      "off",
    );
    void actions
      .configure({
        ...session,
        providerSnapshot: { ...next, thinkingLevel: nextThinking },
      })
      .catch(notifyFailure);
  };

  const changeThinkingLevel = (level: AgentThinkingLevel) => {
    if (!snapshot) return;
    void actions
      .configure({
        ...session,
        providerSnapshot: { ...snapshot, thinkingLevel: level },
      })
      .catch(notifyFailure);
  };

  const saveMemory = async () => {
    setSavingMemory(true);
    try {
      const result = await desktopApi.saveSessionMemory({
        sessionId: session.id,
      });
      if (result.saved) {
        toast.success(t("session.saved"));
      } else if (result.reason === "duplicate") {
        toast.info(t("session.alreadySaved"));
      } else {
        toast.error(result.reason ?? t("session.saveFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("session.saveFailed"),
      );
    } finally {
      setSavingMemory(false);
    }
  };

  return (
    <ChatView
      key={session.id}
      agentLabel={getAgentDisplayLabel(session.agentType)}
      agentType={session.agentType}
      chatComposer={{
        controls: (
          <ModelPicker
            disabled={isRunning}
            modelId={snapshot?.modelId ?? null}
            onChange={changeModel}
            onThinkingLevelChange={changeThinkingLevel}
            providerId={snapshot?.providerId ?? null}
            thinkingLevel={thinkingLevel}
            thinkingLevelOptions={thinkingLevelOptions}
          />
        ),
        footerTrailing: (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={t("session.save")}
                  disabled={savingMemory}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => void saveMemory()}
                >
                  <Brain className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {savingMemory ? t("session.saving") : t("session.save")}
              </TooltipContent>
            </Tooltip>
            <ChatContextMeter sessionId={session.id} snapshot={snapshot} />
          </div>
        ),
      }}
      composerRef={composerRef}
      isRunning={isRunning}
      messages={messages}
      onSend={(text, attachments) => {
        void actions.send(session, text, attachments, thinkingLevel);
        return "sent";
      }}
      onStop={() => {
        void actions.stop(session).catch(notifyFailure);
      }}
      providerSnapshot={snapshot}
      sessionId={session.id}
      sessionModeId={null}
      status={session.status}
      toolCalls={toolCalls}
    />
  );
}
