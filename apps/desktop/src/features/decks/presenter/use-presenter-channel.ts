import type { DeckContent } from "@cocurdex/shared";
import { useCallback, useEffect, useRef } from "react";
import {
  type AudienceMessage,
  audienceChannelName,
  type PresenterMessage,
} from "../audience/audience-channel";

interface PresenterChannelOptions {
  channel: string;
  content: DeckContent;
  index: number;
  onNavigate: (index: number) => void;
  onAudienceClosed: () => void;
}

export function usePresenterChannel({
  channel,
  content,
  index,
  onNavigate,
  onAudienceClosed,
}: PresenterChannelOptions) {
  const portRef = useRef<BroadcastChannel | null>(null);
  const latest = useRef({ content, index, onNavigate, onAudienceClosed });
  useEffect(() => {
    latest.current = { content, index, onNavigate, onAudienceClosed };
  });

  useEffect(() => {
    const port = new BroadcastChannel(audienceChannelName(channel));
    portRef.current = port;
    const show = () =>
      port.postMessage({
        type: "show",
        content: latest.current.content,
        index: latest.current.index,
      } satisfies PresenterMessage);
    port.onmessage = (event: MessageEvent<AudienceMessage>) => {
      const message = event.data;
      if (message.type === "ready") show();
      else if (message.type === "navigate")
        latest.current.onNavigate(message.index);
      else latest.current.onAudienceClosed();
    };
    const end = () =>
      port.postMessage({ type: "end" } satisfies PresenterMessage);
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      port.close();
      portRef.current = null;
    };
  }, [channel]);

  useEffect(() => {
    portRef.current?.postMessage({
      type: "show",
      content,
      index,
    } satisfies PresenterMessage);
  }, [content, index]);

  return useCallback(() => {
    portRef.current?.postMessage({ type: "end" } satisfies PresenterMessage);
  }, []);
}
