import { describe, expect, it } from "vitest";

import { formatContextBytes, splitWorkspaceReferences } from "./message-utils";

describe("AI message utilities", () => {
  it("splits workspace references into clickable parts", () => {
    expect(
      splitWorkspaceReferences("查看 [[notes/a.md]] 和 [[b.md]]。"),
    ).toEqual([
      { type: "text", value: "查看 " },
      { type: "reference", value: "notes/a.md" },
      { type: "text", value: " 和 " },
      { type: "reference", value: "b.md" },
      { type: "text", value: "。" },
    ]);
  });

  it("formats context sizes for the UI", () => {
    expect(formatContextBytes(900)).toBe("900 B");
    expect(formatContextBytes(2048)).toBe("2 KB");
    expect(formatContextBytes(1_572_864)).toBe("1.5 MB");
  });
});
