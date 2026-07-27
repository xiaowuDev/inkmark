import type { Workspace } from "../domain";

export const MAX_RECENT_WORKSPACES = 5;

const STORAGE_KEY = "inkmark.recentWorkspaces.v1";

function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Workspace>;
  return (
    typeof candidate.rootName === "string" &&
    candidate.rootName.length > 0 &&
    typeof candidate.rootPath === "string" &&
    candidate.rootPath.length > 0
  );
}

export function addRecentWorkspace(
  workspaces: readonly Workspace[],
  workspace: Workspace,
): Workspace[] {
  return [
    workspace,
    ...workspaces.filter(
      (candidate) => candidate.rootPath !== workspace.rootPath,
    ),
  ].slice(0, MAX_RECENT_WORKSPACES);
}

export function loadRecentWorkspaces(): Workspace[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(stored)
      ? stored.filter(isWorkspace).slice(0, MAX_RECENT_WORKSPACES)
      : [];
  } catch {
    return [];
  }
}

export function persistRecentWorkspaces(
  workspaces: readonly Workspace[],
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch {
    // 最近工作区只是启动辅助，存储不可用不应影响文件编辑。
  }
}
