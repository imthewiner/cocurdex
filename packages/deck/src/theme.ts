import type { DeckColor, DeckThemeId, TextRole } from "@cocurdex/shared";

export interface RoleTypography {
  maxSize: number;
  minSize: number;
  bold: boolean;
  lineHeight: number;
}

export interface DeckTheme {
  colors: Record<DeckColor, string>;
  fontFamily: string;
  monoFontFamily: string;
  roles: Record<TextRole, RoleTypography>;
}

export const DECK_THEMES: Record<DeckThemeId, DeckTheme> = {
  default: {
    colors: {
      text: "1F2328",
      muted: "59636E",
      accent: "2563EB",
      page: "FFFFFF",
      surface: "F1F3F5",
      onAccent: "FFFFFF",
    },
    fontFamily: "Arial",
    monoFontFamily: "Courier New",
    roles: {
      title: { maxSize: 44, minSize: 28, bold: true, lineHeight: 1.15 },
      subtitle: { maxSize: 28, minSize: 18, bold: false, lineHeight: 1.3 },
      body: { maxSize: 28, minSize: 16, bold: false, lineHeight: 1.3 },
      caption: { maxSize: 18, minSize: 12, bold: false, lineHeight: 1.3 },
    },
  },
};

export function deckTheme(themeId: DeckThemeId): DeckTheme {
  return DECK_THEMES[themeId];
}
