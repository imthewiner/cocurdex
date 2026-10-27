import { isSupportedLocale, type SupportedLocale } from "@cocurdex/shared";

export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;
export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type LanguagePreference = "system" | SupportedLocale;

export interface Preferences {
  appearance: AppearancePreference;
  language: LanguagePreference;
}

export const DEFAULT_PREFERENCES: Preferences = {
  appearance: "system",
  language: "system",
};

function isAppearance(value: unknown): value is AppearancePreference {
  return APPEARANCE_PREFERENCES.some((candidate) => candidate === value);
}

function isLanguage(value: unknown): value is LanguagePreference {
  return (
    value === "system" ||
    (typeof value === "string" && isSupportedLocale(value))
  );
}

export function parsePreferences(text: string | null): Preferences {
  if (!text) return DEFAULT_PREFERENCES;
  let stored: unknown;
  try {
    stored = JSON.parse(text);
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (typeof stored !== "object" || stored === null) return DEFAULT_PREFERENCES;
  const record = stored as Record<string, unknown>;
  return {
    appearance: isAppearance(record.appearance)
      ? record.appearance
      : DEFAULT_PREFERENCES.appearance,
    language: isLanguage(record.language)
      ? record.language
      : DEFAULT_PREFERENCES.language,
  };
}

export type ColorSchemeName = "light" | "dark";

export function resolveColorScheme(
  appearance: AppearancePreference,
  systemScheme: string | null | undefined,
): ColorSchemeName {
  if (appearance !== "system") return appearance;
  return systemScheme === "dark" ? "dark" : "light";
}

export function resolveLocale(
  language: LanguagePreference,
  systemLocale: SupportedLocale,
): SupportedLocale {
  return language === "system" ? systemLocale : language;
}
