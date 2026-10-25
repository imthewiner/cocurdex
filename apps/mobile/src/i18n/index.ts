import "./plural-rules";
import { DEFAULT_LOCALE, supportedLocales } from "@cocurdex/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { AppState } from "react-native";
import { getSystemLocale } from "./language";
import { resources } from "./resources";

void i18n.use(initReactI18next).init({
  defaultNS: "common",
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  lng: getSystemLocale(),
  resources,
  supportedLngs: [...supportedLocales],
});

AppState.addEventListener("change", (state) => {
  if (state !== "active") return;
  const locale = getSystemLocale();
  if (locale !== i18n.language) void i18n.changeLanguage(locale);
});

export { i18n };
