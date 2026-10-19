import type { DeckRecord } from "@cocurdex/shared";
import { useAtomValue, useSetAtom } from "jotai";
import { Play, Presentation } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TITLEBAR_ICON_GLYPH_CLASS,
  TitlebarIconButton,
} from "@/app/layout/titlebar-icon-button";
import { EmptyState, ScrollArea, Text } from "@/components/ui";
import { exportDeckWithFeedback } from "./deck-actions";
import { DeckExportMenu } from "./deck-export-menu";
import { DeckFilmstrip } from "./deck-filmstrip";
import { DeckPresentation } from "./deck-presentation";
import { activeSlideIndexAtom, selectSlideAtom } from "./decks-store";
import { SlideCanvas } from "./slide-canvas";

export function DeckViewer({ deck }: { deck: DeckRecord }) {
  const { t } = useTranslation("decks");
  const activeIndex = useAtomValue(activeSlideIndexAtom);
  const selectSlide = useSetAtom(selectSlideAtom);
  const [presenting, setPresenting] = useState(false);
  const slides = deck.content.slides;
  const slide = slides[activeIndex];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 ps-3 pe-1.5">
        <Text
          size="meta"
          weight="medium"
          className="min-w-0 flex-1 truncate text-editor-fg"
        >
          {deck.title || t("sidebar.untitled")}
        </Text>
        {slides.length > 0 ? (
          <Text
            as="span"
            size="meta"
            tone="muted"
            className="shrink-0 tabular-nums"
          >
            {t("viewer.position", {
              current: activeIndex + 1,
              total: slides.length,
            })}
          </Text>
        ) : null}
        <TitlebarIconButton
          aria-label={t("actions.present")}
          tooltip={t("actions.present")}
          disabled={slides.length === 0}
          onClick={() => setPresenting(true)}
        >
          <Play className={TITLEBAR_ICON_GLYPH_CLASS} />
        </TitlebarIconButton>
        <DeckExportMenu
          onExport={(format) =>
            void exportDeckWithFeedback(deck.id, format, t("errors.export"))
          }
        />
      </div>
      {slide ? (
        <>
          <section
            aria-label={t("viewer.slide", { number: activeIndex + 1 })}
            className="flex min-h-0 flex-1 items-center justify-center p-4 [container-type:size]"
          >
            <SlideCanvas
              slide={slide}
              content={deck.content}
              className="w-[min(100cqw,calc(100cqh*16/9))] rounded-dense shadow-md ring-1 ring-border"
            />
          </section>
          {slide.notes ? (
            <ScrollArea className="max-h-24 shrink-0 border-t border-border">
              <section aria-label={t("viewer.notes")} className="px-3 py-2">
                <Text size="body" tone="muted" className="whitespace-pre-wrap">
                  {slide.notes}
                </Text>
              </section>
            </ScrollArea>
          ) : null}
          <DeckFilmstrip
            content={deck.content}
            activeIndex={activeIndex}
            onSelect={selectSlide}
          />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Presentation />}
            title={t("viewer.emptyDeck.title")}
            description={t("viewer.emptyDeck.description")}
          />
        </div>
      )}
      {presenting ? (
        <DeckPresentation
          content={deck.content}
          startIndex={activeIndex}
          onExit={(lastIndex) => {
            setPresenting(false);
            selectSlide(lastIndex);
          }}
        />
      ) : null}
    </div>
  );
}
