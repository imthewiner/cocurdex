import type { BundledLanguage, Highlighter } from "shiki";
import { normalizeCodeLanguage } from "./code-languages";

export interface CodeToken {
  from: number;
  to: number;
  style: string;
}

export type CodeTokenizer = (
  code: string,
  language: string,
) => readonly CodeToken[] | null;

const CODE_THEMES = { light: "github-light", dark: "github-dark" } as const;
const TOKEN_CACHE_LIMIT = 200;
export const CODE_HIGHLIGHT_MAX_LENGTH = 50_000;

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;
let bundledLanguageNames: ReadonlySet<string> | null = null;
const languageLoads = new Map<string, Promise<boolean>>();
const unsupportedLanguages = new Set<string>();
const tokenCache = new Map<string, readonly CodeToken[]>();

function loadHighlighter() {
  highlighterPromise ??= import("shiki")
    .then(async ({ bundledLanguages, createHighlighter }) => {
      bundledLanguageNames = new Set(Object.keys(bundledLanguages));
      highlighter = await createHighlighter({
        themes: [CODE_THEMES.light, CODE_THEMES.dark],
        langs: [],
      });
      return highlighter;
    })
    .catch((error) => {
      highlighterPromise = null;
      throw error;
    });
  return highlighterPromise;
}

export function loadCodeLanguage(raw: string): Promise<boolean> {
  const language = normalizeCodeLanguage(raw);
  const pending = languageLoads.get(language);
  if (pending) return pending;
  const load = loadHighlighter()
    .then(async (loaded) => {
      if (!bundledLanguageNames?.has(language)) {
        unsupportedLanguages.add(language);
        return false;
      }
      await loaded.loadLanguage(language as BundledLanguage);
      return true;
    })
    .catch(() => {
      languageLoads.delete(language);
      return false;
    });
  languageLoads.set(language, load);
  return load;
}

function styleOf(htmlStyle: Record<string, string> | undefined) {
  if (!htmlStyle) return "";
  return Object.entries(htmlStyle)
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
}

function remember(key: string, tokens: readonly CodeToken[]) {
  tokenCache.delete(key);
  tokenCache.set(key, tokens);
  if (tokenCache.size > TOKEN_CACHE_LIMIT) {
    const oldest = tokenCache.keys().next().value;
    if (oldest !== undefined) tokenCache.delete(oldest);
  }
  return tokens;
}

export const tokenizeCode: CodeTokenizer = (code, raw) => {
  const language = normalizeCodeLanguage(raw);
  if (unsupportedLanguages.has(language)) return [];
  if (!highlighter?.getLoadedLanguages().includes(language)) return null;
  const key = `${language}\0${code}`;
  const cached = tokenCache.get(key);
  if (cached) return remember(key, cached);
  const lines = highlighter.codeToTokens(code, {
    lang: language as BundledLanguage,
    themes: CODE_THEMES,
    defaultColor: false,
  }).tokens;
  const tokens = lines.flat().flatMap((token) => {
    const style = styleOf(token.htmlStyle);
    if (!style || token.content.length === 0) return [];
    return [
      { from: token.offset, to: token.offset + token.content.length, style },
    ];
  });
  return remember(key, tokens);
};
