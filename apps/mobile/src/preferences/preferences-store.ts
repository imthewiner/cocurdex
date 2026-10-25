import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import {
  type AppearancePreference,
  type LanguagePreference,
  type Preferences,
  parsePreferences,
} from "./preferences";

const file = new File(Paths.document, "preferences.json");
const listeners = new Set<() => void>();

function readStored() {
  try {
    return parsePreferences(file.exists ? file.textSync() : null);
  } catch {
    return parsePreferences(null);
  }
}

function applyAppearance(appearance: AppearancePreference) {
  Appearance.setColorScheme(
    appearance === "system" ? "unspecified" : appearance,
  );
}

let current = readStored();
applyAppearance(current.appearance);

function update(next: Preferences) {
  current = next;
  for (const listener of listeners) listener();
  void file.write(JSON.stringify(next)).catch(() => undefined);
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentPreferences() {
  return current;
}

export function setAppearance(appearance: AppearancePreference) {
  if (appearance === current.appearance) return;
  applyAppearance(appearance);
  update({ ...current, appearance });
}

export function setLanguage(language: LanguagePreference) {
  if (language === current.language) return;
  update({ ...current, language });
}

export function usePreferences() {
  return useSyncExternalStore(subscribePreferences, currentPreferences);
}
