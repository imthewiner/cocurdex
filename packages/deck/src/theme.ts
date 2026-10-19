import type { DeckColor, DeckThemeId, TextRole } from "@cocurdex/shared";

export interface RoleTypography {
  maxSize: number;
  minSize: number;
  bold: boolean;
  lineHeight: number;
}

export interface DeckTheme {
  colors: Record<DeckColor, string>;
  tableBorder: string;
  fontFamily: string;
  monoFontFamily: string;
  roles: Record<TextRole, RoleTypography>;
}

const FONT_FAMILY = "Arial";
const MONO_FONT_FAMILY = "Courier New";

const ROLES: Record<TextRole, RoleTypography> = {
  title: { maxSize: 44, minSize: 28, bold: true, lineHeight: 1.15 },
  subtitle: { maxSize: 28, minSize: 18, bold: false, lineHeight: 1.3 },
  body: { maxSize: 28, minSize: 16, bold: false, lineHeight: 1.3 },
  caption: { maxSize: 18, minSize: 12, bold: false, lineHeight: 1.3 },
};

function themeOf(
  colors: Record<DeckColor, string>,
  tableBorder: string,
): DeckTheme {
  return {
    colors,
    tableBorder,
    fontFamily: FONT_FAMILY,
    monoFontFamily: MONO_FONT_FAMILY,
    roles: ROLES,
  };
}

export const DECK_THEMES: Record<DeckThemeId, DeckTheme> = {
  default: themeOf(
    {
      text: "1F2328",
      muted: "59636E",
      accent: "2563EB",
      page: "FFFFFF",
      surface: "F1F3F5",
      onAccent: "FFFFFF",
    },
    "D0D7DE",
  ),
  midnight: themeOf(
    {
      text: "E6EDF3",
      muted: "9BA6B2",
      accent: "6E8BFF",
      page: "0F141B",
      surface: "1C2430",
      onAccent: "0F141B",
    },
    "3A4655",
  ),
  sand: themeOf(
    {
      text: "2B2118",
      muted: "75665A",
      accent: "B4471B",
      page: "FBF7F0",
      surface: "F0E7DA",
      onAccent: "FFFFFF",
    },
    "DCCDBA",
  ),
  forest: themeOf(
    {
      text: "17251D",
      muted: "56675C",
      accent: "1E6B47",
      page: "FFFFFF",
      surface: "EAF2EC",
      onAccent: "FFFFFF",
    },
    "C9D8CD",
  ),
};

export function deckTheme(themeId: DeckThemeId): DeckTheme {
  return DECK_THEMES[themeId];
}
