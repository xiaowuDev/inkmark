import { describe, expect, it } from "vitest";

import { findMatchOffsets } from "./editor-search";

describe("findMatchOffsets", () => {
  it("finds every non-overlapping occurrence", () => {
    expect(findMatchOffsets("cat cat cat", "cat", true)).toEqual([0, 4, 8]);
  });

  it("advances past a full match instead of overlapping", () => {
    expect(findMatchOffsets("aaaa", "aa", true)).toEqual([0, 2]);
  });

  it("ignores case unless case sensitivity is requested", () => {
    expect(findMatchOffsets("Cat cAt", "cat", false)).toEqual([0, 4]);
    expect(findMatchOffsets("Cat cAt", "cat", true)).toEqual([]);
  });

  it("matches CJK text", () => {
    expect(findMatchOffsets("墨记编辑器，墨记", "墨记", false)).toEqual([0, 6]);
  });

  it("returns nothing for an empty query", () => {
    expect(findMatchOffsets("anything", "", false)).toEqual([]);
  });

  it("caps the number of matches", () => {
    expect(findMatchOffsets("aaaa", "a", true, 3)).toHaveLength(3);
  });
});
