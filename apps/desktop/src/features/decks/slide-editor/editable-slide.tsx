import {
  deckTheme,
  type ResolvedItem,
  type ResolvedText,
  resolveEmptySlots,
  resolveSlide,
  TEXT_INSET,
} from "@cocurdex/deck";
import type {
  DeckContent,
  DeckTextTarget,
  Slide,
  TextParagraph,
} from "@cocurdex/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib";
import { SlideCanvas, slideItemKey } from "../slide-canvas";
import { frameStyle, slideLength, themeColor } from "../slide-geometry";
import { SlideTextEditor } from "./slide-text-editor";

const VALIGN_JUSTIFY = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
} as const;

function isText(item: ResolvedItem): item is ResolvedText {
  return item.kind === "text";
}

function placeholderKey(item: ResolvedText) {
  if (item.source.kind !== "slot") return "editor.placeholders.text";
  if (item.source.slot === "title") return "editor.placeholders.title";
  if (item.source.slot === "subtitle") return "editor.placeholders.subtitle";
  return "editor.placeholders.text";
}

function useTargetLabels() {
  const { t } = useTranslation("decks");
  return (item: ResolvedText) => {
    const name =
      item.source.kind === "slot"
        ? t(`editor.slots.${item.source.slot}`)
        : t("editor.slots.textBox");
    return {
      edit: t("editor.edit", { name }),
      name,
      placeholder: t(placeholderKey(item)),
    };
  };
}

export function EditableSlide({
  slide,
  content,
  className,
  onEditText,
}: {
  slide: Slide;
  content: DeckContent;
  className?: string;
  onEditText: (
    target: DeckTextTarget,
    paragraphs: TextParagraph[],
  ) => Promise<void>;
}) {
  const labels = useTargetLabels();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const theme = deckTheme(content.theme);
  const targets = [
    ...resolveSlide(slide, content).items.filter(isText),
    ...resolveEmptySlots(slide, content),
  ];
  const editing = targets.find((item) => slideItemKey(item) === editingKey);
  const stopEditing = () => setEditingKey(null);

  return (
    <SlideCanvas
      slide={slide}
      content={content}
      className={className}
      hiddenItemKey={editing ? editingKey : null}
    >
      {targets.map((item) => {
        const key = slideItemKey(item);
        if (key === editingKey) return null;
        const label = labels(item);
        const isEmpty = item.paragraphs.length === 0;
        return (
          <button
            key={key}
            type="button"
            aria-label={label.edit}
            data-slide-target={key}
            className={cn(
              "absolute flex cursor-text flex-col rounded-dense outline-none transition-shadow hover:ring-1 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring",
              isEmpty && "border border-current border-dashed",
            )}
            style={{
              ...frameStyle(item.frame),
              padding: slideLength(TEXT_INSET),
              justifyContent: VALIGN_JUSTIFY[item.valign],
              textAlign: item.align,
              color: themeColor(theme, item.color),
              fontSize: slideLength(item.fontSize),
              fontWeight: item.bold ? 700 : 400,
              lineHeight: item.lineHeight,
              opacity: isEmpty ? 0.45 : undefined,
            }}
            onClick={() => setEditingKey(key)}
          >
            {isEmpty ? label.placeholder : null}
          </button>
        );
      })}
      {editing ? (
        <SlideTextEditor
          key={editingKey}
          item={editing}
          theme={theme}
          label={labels(editing).name}
          placeholder={labels(editing).placeholder}
          onCancel={stopEditing}
          onCommit={(paragraphs) => {
            void onEditText(
              slideItemKey(editing) as DeckTextTarget,
              paragraphs,
            ).finally(stopEditing);
          }}
        />
      ) : null}
    </SlideCanvas>
  );
}
