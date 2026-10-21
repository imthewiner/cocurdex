import { describe, expect, it } from "vitest";
import { mergeDirectoryEntries } from "@/features/editor/file-tree-directory-entries";

function entry(relativePath: string, kind: "directory" | "file") {
  return {
    kind,
    name: relativePath.split("/").at(-1) ?? relativePath,
    path: `/repo/${relativePath}`,
    relativePath,
  };
}

describe("mergeDirectoryEntries", () => {
  it("adds the children a capped listing left out of an expanded folder", () => {
    const base = [
      entry("src", "directory"),
      entry("src/auth", "directory"),
      entry("src/index.ts", "file"),
    ];
    const loaded = [
      entry("src/auth/nested", "directory"),
      entry("src/auth/token.ts", "file"),
    ];

    expect(
      mergeDirectoryEntries(base, loaded).map((item) => item.relativePath),
    ).toEqual([
      "src",
      "src/auth",
      "src/index.ts",
      "src/auth/nested",
      "src/auth/token.ts",
    ]);
  });

  it("keeps the base listing as is when nothing is missing", () => {
    const base = [entry("src", "directory"), entry("src/index.ts", "file")];

    expect(mergeDirectoryEntries(base, [])).toBe(base);
    expect(
      mergeDirectoryEntries(base, [entry("src/index.ts", "file")]),
    ).toEqual(base);
  });
});
