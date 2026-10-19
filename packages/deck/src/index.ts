export { checkDeck } from "./check";
export { type LayoutSpec, SLIDE_LAYOUTS, type SlotSpec } from "./layouts";
export {
  type ResolvedItem,
  type ResolvedShape,
  type ResolvedSlide,
  type ResolvedSource,
  type ResolvedTable,
  type ResolvedText,
  resolveSlide,
} from "./resolve";
export { deckContentSchema, parseDeckContent } from "./schema";
export { TABLE_CELL_PADDING, TEXT_INSET } from "./text-fit";
export { DECK_THEMES, type DeckTheme, deckTheme } from "./theme";
