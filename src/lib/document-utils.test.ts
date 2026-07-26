import { describe, expect, it } from "vitest";

import type { EditorTab } from "../domain";
import {
  countDocumentStats,
  fileNameFromPath,
  nextUntitledName,
  selectTabAfterClose,
} from "./document-utils";

function tab(id: string, name = id): EditorTab {
  return {
    id,
    name,
    path: null,
    isDirty: false,
    isLoading: false,
    saveState: "idle",
    errorMessage: null,
  };
}

describe("document utilities", () => {
  it("counts Chinese characters and Latin words without double counting", () => {
    expect(countDocumentStats("你好, InkMark editor.\n第二行")).toEqual({
      characters: 23,
      lines: 2,
      words: 7,
    });
  });

  it("extracts file names on macOS and Windows paths", () => {
    expect(fileNameFromPath("/Users/demo/notes/readme.md")).toBe("readme.md");
    expect(fileNameFromPath("C:\\notes\\readme.md")).toBe("readme.md");
  });

  it("generates the first available untitled name", () => {
    expect(nextUntitledName([tab("1", "未命名"), tab("2", "未命名 2")])).toBe(
      "未命名 3",
    );
  });

  it("selects a stable neighboring tab when the active tab closes", () => {
    const tabs = [tab("a"), tab("b"), tab("c")];
    expect(selectTabAfterClose(tabs, "b", "b")).toBe("c");
    expect(selectTabAfterClose(tabs, "a", "b")).toBe("a");
    expect(
      selectTabAfterClose(
        tabs.filter((item) => item.id !== "b"),
        "b",
        "b",
      ),
    ).toBeNull();
    expect(selectTabAfterClose(tabs, "c", "c")).toBe("b");
  });
});
