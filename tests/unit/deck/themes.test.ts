import type { DeckTheme } from "@cocurdex/deck";
import { DECK_THEMES, paintHex, resolveSlide } from "@cocurdex/deck";
import { compileDeckMarkdown } from "@cocurdex/deck/markdown";
import {
  DECK_THEME_IDS,
  type DeckContent,
  SLIDE_LAYOUT_IDS,
} from "@cocurdex/shared";
import { describe, expect, it } from "vitest";

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function backgroundHexes(
  theme: DeckTheme,
  layout: (typeof SLIDE_LAYOUT_IDS)[number],
) {
  const paint = theme.layouts[layout].background;
  if (typeof paint === "string") return [paintHex(theme, paint)];
  return paint.stops.map((stop) => paintHex(theme, stop.color));
}

function deckWithEveryLayout(theme: DeckContent["theme"]): DeckContent {
  const { content } = compileDeckMarkdown("# Cover\nSubtitle");
  const [cover] = content.slides;
  if (!cover) throw new Error("No slide");
  return {
    ...content,
    theme,
    slides: SLIDE_LAYOUT_IDS.map((layout, index) => ({
      ...cover,
      id: `slide-${index}`,
      layout,
      slots: {
        title: cover.slots.title,
        subtitle: cover.slots.subtitle,
        body: cover.slots.subtitle,
        left: cover.slots.subtitle,
        right: cover.slots.subtitle,
      },
    })),
  };
}

describe.each(DECK_THEME_IDS)("theme %s", (themeId) => {
  const theme = DECK_THEMES[themeId];
  const deck = deckWithEveryLayout(themeId);

  it("keeps slot text readable on every layout background", () => {
    for (const slide of deck.slides) {
      const resolved = resolveSlide(slide, deck);
      for (const item of resolved.items) {
        if (item.kind !== "text" || item.source.kind !== "slot") continue;
        const minimum = item.role === "title" ? 3 : 4.5;
        for (const background of backgroundHexes(theme, slide.layout)) {
          expect(
            contrast(theme.colors[item.color], background),
            `${slide.layout} ${item.source.slot} on #${background}`,
          ).toBeGreaterThanOrEqual(minimum);
        }
      }
    }
  });

  it("numbers pages by slide position and never on the cover", () => {
    const numbers = deck.slides.map((slide) =>
      resolveSlide(slide, deck)
        .items.filter(
          (item) => item.kind === "text" && item.source.kind === "decoration",
        )
        .map((item) =>
          item.kind === "text" ? item.paragraphs[0]?.runs[0]?.text : "",
        ),
    );
    const coverIndex = SLIDE_LAYOUT_IDS.indexOf("cover");
    const contentIndex = SLIDE_LAYOUT_IDS.indexOf("title-content");

    expect(numbers[coverIndex]).toEqual([]);
    expect(numbers[contentIndex]).toEqual([String(contentIndex + 1)]);
  });
});

describe("theme typography", () => {
  it("sets editorial titles in a serif face", () => {
    const deck = deckWithEveryLayout("editorial");
    const [cover] = deck.slides;
    if (!cover) throw new Error("No slide");
    const title = resolveSlide(cover, deck).items.find(
      (item) => item.kind === "text" && item.source.kind === "slot",
    );

    expect(title).toMatchObject({ font: "serif", bold: false });
  });
});
