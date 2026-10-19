import type { DeckThemeId } from "@cocurdex/shared";
import type { DeckTheme } from "../theme";
import { BOARDROOM_THEME, POP_THEME } from "./bold";
import { CLASSIC_THEMES } from "./classic";
import { ACADEMIC_THEME, EDITORIAL_THEME } from "./editorial";
import { EMBER_THEME, NEBULA_THEME } from "./gradient";
import { TECH_THEME } from "./minimal";

export const DECK_THEMES: Record<DeckThemeId, DeckTheme> = {
  ...CLASSIC_THEMES,
  tech: TECH_THEME,
  editorial: EDITORIAL_THEME,
  academic: ACADEMIC_THEME,
  pop: POP_THEME,
  boardroom: BOARDROOM_THEME,
  nebula: NEBULA_THEME,
  ember: EMBER_THEME,
};

export function deckTheme(themeId: DeckThemeId): DeckTheme {
  return DECK_THEMES[themeId];
}
