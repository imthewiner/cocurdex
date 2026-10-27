import { useState } from "react";
import { ListSheet, type ListSheetItem } from "./list-sheet";

const SCROLL_AFTER_ITEMS = 6;

export interface OptionSheetRequest {
  title: string;
  subtitle?: string | null;
  items: readonly ListSheetItem[];
}

export type OpenOptionSheet = (request: OptionSheetRequest) => void;

export function useOptionSheet() {
  const [request, setRequest] = useState<OptionSheetRequest | null>(null);
  const [presented, setPresented] = useState(false);
  const close = () => setPresented(false);
  const open: OpenOptionSheet = (next) => {
    setRequest(next);
    setPresented(true);
  };
  const items = (request?.items ?? []).map((item) => ({
    ...item,
    onPress: () => {
      close();
      item.onPress();
    },
  }));
  const sheet = (
    <ListSheet
      presented={presented}
      title={request?.title ?? ""}
      subtitle={request?.subtitle}
      items={items}
      scrollable={items.length > SCROLL_AFTER_ITEMS}
      onDismiss={close}
    />
  );
  return { sheet, open };
}
