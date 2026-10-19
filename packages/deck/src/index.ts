export { checkDeck } from "./check";
export { type LayoutSpec, SLIDE_LAYOUTS, type SlotSpec } from "./layouts";
export { listMarkers } from "./list-markers";
export {
  type ResolvedItem,
  type ResolvedShape,
  type ResolvedSlide,
  type ResolvedSource,
  type ResolvedTable,
  type ResolvedText,
  resolveSlide,
} from "./resolve";
export {
  deckContentSchema,
  deckOpSchema,
  deckOpsSchema,
  parseDeckContent,
} from "./schema";
export {
  LIST_INDENT_EM,
  PARAGRAPH_GAP_EM,
  paragraphIndentEm,
  TABLE_CELL_PADDING,
  TEXT_INSET,
} from "./text-fit";
export { DECK_THEMES, type DeckTheme, deckTheme } from "./theme";
