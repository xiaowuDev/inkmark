import { describe, expect, it } from "vitest";

import type { Workspace } from "../domain";
import { addRecentWorkspace, MAX_RECENT_WORKSPACES } from "./recent-workspaces";

function workspace(index: number): Workspace {
  return {
    rootName: `Workspace ${String(index)}`,
    rootPath: `/workspaces/${String(index)}`,
  };
}

describe("recent workspaces", () => {
  it("keeps the most recently opened workspace first without duplicates", () => {
    const existing = [workspace(1), workspace(2), workspace(3)];

    expect(addRecentWorkspace(existing, workspace(2))).toEqual([
      workspace(2),
      workspace(1),
      workspace(3),
    ]);
  });

  it("drops the least recently opened workspace after the limit", () => {
    const existing = Array.from({ length: MAX_RECENT_WORKSPACES }, (_, index) =>
      workspace(index + 1),
    );

    expect(addRecentWorkspace(existing, workspace(6))).toEqual([
      workspace(6),
      workspace(1),
      workspace(2),
      workspace(3),
      workspace(4),
    ]);
  });
});
