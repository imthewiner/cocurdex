import type {
  DeckOp,
  DeckRecord,
  DeckTextTarget,
  DeckThemeId,
  SlideLayoutId,
  TextParagraph,
} from "@cocurdex/shared";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  activeSlideIndexAtom,
  editActiveDeckAtom,
  selectSlideAtom,
} from "./decks-store";

export type SlideAction = "duplicate" | "moveEarlier" | "moveLater" | "delete";

function slideActionOps(
  action: SlideAction,
  slideId: string,
  index: number,
): DeckOp[] {
  switch (action) {
    case "duplicate":
      return [{ op: "duplicateSlide", slideId }];
    case "moveEarlier":
      return [{ op: "moveSlide", slideId, index: index - 1 }];
    case "moveLater":
      return [{ op: "moveSlide", slideId, index: index + 1 }];
    case "delete":
      return [{ op: "deleteSlide", slideId }];
  }
}

function selectionAfter(action: SlideAction, index: number): number {
  if (action === "duplicate" || action === "moveLater") return index + 1;
  if (action === "moveEarlier") return index - 1;
  return index;
}

export function useDeckEditing(deck: DeckRecord) {
  const { t } = useTranslation("decks");
  const edit = useSetAtom(editActiveDeckAtom);
  const selectSlide = useSetAtom(selectSlideAtom);
  const activeIndex = useAtomValue(activeSlideIndexAtom);
  const slides = deck.content.slides;

  const apply = async (ops: DeckOp[], selectIndex?: number) => {
    try {
      await edit(ops);
      if (selectIndex !== undefined) selectSlide(selectIndex);
    } catch (error) {
      toast.error(t("errors.edit"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const activeSlideId = slides[activeIndex]?.id;

  return {
    addSlide: (layout: SlideLayoutId) => {
      const index = slides.length === 0 ? 0 : activeIndex + 1;
      void apply([{ op: "addSlide", layout, index }], index);
    },
    setLayout: (layout: SlideLayoutId) => {
      if (!activeSlideId) return;
      void apply([{ op: "setLayout", slideId: activeSlideId, layout }]);
    },
    setTheme: (theme: DeckThemeId) => {
      void apply([{ op: "setTheme", theme }]);
    },
    editText: (
      slideId: string,
      target: DeckTextTarget,
      paragraphs: TextParagraph[],
    ) => apply([{ op: "setText", slideId, target, paragraphs }]),
    setNotes: (slideId: string, notes: string) => {
      void apply([{ op: "setNotes", slideId, notes }]);
    },
    slideAction: (action: SlideAction, index: number) => {
      const slideId = slides[index]?.id;
      if (!slideId) return;
      void apply(
        slideActionOps(action, slideId, index),
        selectionAfter(action, index),
      );
    },
  };
}
