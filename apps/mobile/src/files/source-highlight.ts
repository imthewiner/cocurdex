import { useSyncExternalStore } from "react";
import {
  createHighlighterCore,
  type GrammarState,
  type HighlighterCore,
  type ThemedToken,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { loadSourceLanguage } from "./source-language";

export type SourceScheme = "light" | "dark";
export type SourceTokens = readonly (readonly ThemedToken[])[];

const THEMES: Record<SourceScheme, string> = {
  light: "github-light-default",
  dark: "github-dark-default",
};
const CHUNK_LINES = 40;
const MAX_HIGHLIGHTED_LINES = 20_000;
const MAX_TOKENIZED_LINE_LENGTH = 1_000;
const CACHED_FILES = 8;

let highlighter: Promise<HighlighterCore> | null = null;

function loadHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [
      import("shiki/themes/github-light-default.mjs"),
      import("shiki/themes/github-dark-default.mjs"),
    ],
    langs: [],
    engine: createJavaScriptRegexEngine({ target: "ES2018", forgiving: true }),
  }).catch((error: unknown) => {
    highlighter = null;
    throw error;
  });
  return highlighter;
}

function nextFrame() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

interface HighlightStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SourceTokens;
}

const EMPTY: SourceTokens = [];

function createHighlightStore(
  lines: readonly string[],
  language: string,
  scheme: SourceScheme,
): HighlightStore {
  const listeners = new Set<() => void>();
  let tokens: SourceTokens = EMPTY;
  let grammarState: GrammarState | undefined;
  let running = false;
  let finished = false;

  async function run() {
    const loader = loadSourceLanguage(language);
    if (!loader) {
      finished = true;
      return;
    }
    const shiki = await loadHighlighter();
    await shiki.loadLanguage(loader);
    const limit = Math.min(lines.length, MAX_HIGHLIGHTED_LINES);
    while (tokens.length < limit && listeners.size > 0) {
      await nextFrame();
      if (listeners.size === 0) return;
      const start = tokens.length;
      const chunk = lines.slice(start, start + CHUNK_LINES).join("\n");
      const result = shiki.codeToTokens(chunk, {
        lang: language,
        theme: THEMES[scheme],
        grammarState,
        tokenizeMaxLineLength: MAX_TOKENIZED_LINE_LENGTH,
      });
      grammarState = result.grammarState;
      tokens = [...tokens, ...result.tokens];
      for (const listener of [...listeners]) listener();
    }
    finished = tokens.length >= limit;
  }

  function resume() {
    if (running || finished) return;
    running = true;
    void run()
      .catch(() => {
        finished = true;
      })
      .finally(() => {
        running = false;
      });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      resume();
      return () => listeners.delete(listener);
    },
    getSnapshot: () => tokens,
  };
}

const stores = new Map<
  string,
  { lines: readonly string[]; store: HighlightStore }
>();

function highlightStore(
  key: string,
  lines: readonly string[],
  language: string,
  scheme: SourceScheme,
) {
  const cacheKey = `${scheme}:${language}:${key}`;
  const cached = stores.get(cacheKey);
  if (cached && cached.lines === lines) return cached.store;
  const store = createHighlightStore(lines, language, scheme);
  stores.delete(cacheKey);
  stores.set(cacheKey, { lines, store });
  for (const stale of [...stores.keys()].slice(0, -CACHED_FILES)) {
    stores.delete(stale);
  }
  return store;
}

const NO_HIGHLIGHT: HighlightStore = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY,
};

export function useSourceTokens(
  key: string,
  lines: readonly string[],
  language: string | null,
  scheme: SourceScheme,
): SourceTokens {
  const store = language
    ? highlightStore(key, lines, language, scheme)
    : NO_HIGHLIGHT;
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
