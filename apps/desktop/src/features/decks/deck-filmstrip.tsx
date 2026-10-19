import type { DeckContent } from "@cocurdex/shared";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea, ScrollBar, Text } from "@/components/ui";
import { cn } from "@/lib";
import { useScrollIntoViewWhenActive } from "@/lib/react-hooks";
import { SlideCanvas } from "./slide-canvas";
import { filmstripIndexForKey } from "./slide-navigation";

function FilmstripItem({
  content,
  index,
  isActive,
  onSelect,
  onKeyDown,
}: {
  content: DeckContent;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation("decks");
  const ref = useScrollIntoViewWhenActive<HTMLButtonElement>(isActive);
  const slide = content.slides[index];
  if (!slide) return null;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={t("viewer.slide", { number: index + 1 })}
      aria-current={isActive ? "true" : undefined}
      data-slide-id={slide.id}
      className="flex shrink-0 flex-col items-center gap-1 outline-none"
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <span
        className={cn(
          "block w-28 overflow-hidden rounded-dense ring-1 ring-border transition-shadow",
          isActive && "ring-2 ring-ring",
        )}
      >
        <SlideCanvas
          slide={slide}
          content={content}
          className="pointer-events-none w-full"
        />
      </span>
      <Text as="span" size="meta" tone="muted" className="tabular-nums">
        {index + 1}
      </Text>
    </button>
  );
}

export function DeckFilmstrip({
  content,
  activeIndex,
  onSelect,
}: {
  content: DeckContent;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation("decks");
  return (
    <ScrollArea className="w-full shrink-0 border-t border-border">
      <nav aria-label={t("viewer.slides")} className="flex gap-2 p-2">
        {content.slides.map((slide, index) => (
          <FilmstripItem
            key={slide.id}
            content={content}
            index={index}
            isActive={index === activeIndex}
            onSelect={() => onSelect(index)}
            onKeyDown={(event) => {
              const next = filmstripIndexForKey(
                event.key,
                index,
                content.slides.length,
              );
              const target = content.slides[next ?? -1];
              if (next === null || !target) return;
              event.preventDefault();
              onSelect(next);
              event.currentTarget
                .closest("nav")
                ?.querySelector<HTMLButtonElement>(
                  `[data-slide-id="${CSS.escape(target.id)}"]`,
                )
                ?.focus();
            }}
          />
        ))}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
