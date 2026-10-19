import {
  choosePdfFonts,
  pdfFontCandidates,
} from "@cocurdex/daemon/internal/decks/pdf-fonts";
import { describe, expect, it } from "vitest";

describe("pdfFontCandidates", () => {
  it("prefers CJK-capable faces inside system font collections on macOS", () => {
    const candidates = pdfFontCandidates("darwin", {});
    expect(candidates.regular[0]).toEqual({
      path: "/System/Library/Fonts/Hiragino Sans GB.ttc",
      face: "HiraginoSansGB-W3",
    });
    expect(candidates.bold[0]?.face).toBe("HiraginoSansGB-W6");
  });

  it("resolves Windows fonts from the Windows directory", () => {
    const candidates = pdfFontCandidates("win32", { WINDIR: "D:\\Win" });
    expect(candidates.regular[0]).toEqual({
      path: "D:\\Win\\Fonts\\msyh.ttc",
      face: "MicrosoftYaHei",
    });
    expect(candidates.mono[0]?.path).toBe("D:\\Win\\Fonts\\consola.ttf");
  });

  it("falls back to SystemRoot and then the default Windows directory", () => {
    expect(
      pdfFontCandidates("win32", { SystemRoot: "E:\\Sys" }).regular[0]?.path,
    ).toBe("E:\\Sys\\Fonts\\msyh.ttc");
    expect(pdfFontCandidates("win32", {}).regular[0]?.path).toBe(
      "C:\\Windows\\Fonts\\msyh.ttc",
    );
  });

  it("tries Noto CJK before Latin-only fonts on Linux", () => {
    const regular = pdfFontCandidates("linux", {}).regular;
    const firstLatin = regular.findIndex((font) =>
      font.path.endsWith("DejaVuSans.ttf"),
    );
    const lastCjk = regular.findLastIndex((font) =>
      font.path.endsWith("NotoSansCJK-Regular.ttc"),
    );
    expect(lastCjk).toBeGreaterThanOrEqual(0);
    expect(lastCjk).toBeLessThan(firstLatin);
  });
});

describe("choosePdfFonts", () => {
  const candidates = {
    regular: [{ path: "/a.ttc", face: "A" }, { path: "/b.ttf" }],
    bold: [{ path: "/a-bold.ttf" }],
    mono: [{ path: "/mono.ttf" }],
  };

  it("picks the first usable font for each role", () => {
    const usable = new Set(["/b.ttf", "/mono.ttf"]);
    expect(choosePdfFonts(candidates, (font) => usable.has(font.path))).toEqual(
      { regular: { path: "/b.ttf" }, mono: { path: "/mono.ttf" } },
    );
  });

  it("returns null when no regular font is usable", () => {
    expect(
      choosePdfFonts(
        candidates,
        (font) => font.path !== "/b.ttf" && font.path !== "/a.ttc",
      ),
    ).toBeNull();
  });
});
