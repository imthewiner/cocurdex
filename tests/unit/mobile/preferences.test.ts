import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  resolveColorScheme,
  resolveLocale,
} from "@cocurdex/mobile/internal/preferences/preferences";
import { describe, expect, it } from "vitest";

describe("parsePreferences", () => {
  it("reads stored choices", () => {
    expect(
      parsePreferences(
        JSON.stringify({ appearance: "dark", language: "zh-CN" }),
      ),
    ).toEqual({ appearance: "dark", language: "zh-CN" });
  });

  it("falls back per field for missing, unknown, or corrupt values", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("{not json")).toEqual(DEFAULT_PREFERENCES);
    expect(
      parsePreferences(JSON.stringify({ appearance: "sepia", language: "fr" })),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(JSON.stringify({ language: "en-US" }))).toEqual({
      appearance: "system",
      language: "en-US",
    });
  });
});

describe("resolveLocale", () => {
  it("uses the system locale unless the user picked one", () => {
    expect(resolveLocale("system", "zh-CN")).toBe("zh-CN");
    expect(resolveLocale("en-US", "zh-CN")).toBe("en-US");
  });
});

describe("resolveColorScheme", () => {
  it("uses an explicit appearance over the system scheme", () => {
    expect(resolveColorScheme("light", "dark")).toBe("light");
    expect(resolveColorScheme("dark", "light")).toBe("dark");
  });

  it("follows the system scheme and defaults to light", () => {
    expect(resolveColorScheme("system", "dark")).toBe("dark");
    expect(resolveColorScheme("system", "light")).toBe("light");
    expect(resolveColorScheme("system", null)).toBe("light");
  });
});
