import { memo } from "react";

import type { DirectoryEntry, Workspace } from "../domain";
import { Icon } from "./Icon";

interface FileSidebarProps {
  activePath: string | null;
  entriesByDirectory: Readonly<Record<string, readonly DirectoryEntry[]>>;
  expandedPaths: ReadonlySet<string>;
  isVisible: boolean;
  loadingPaths: ReadonlySet<string>;
  workspace: Workspace | null;
  onOpenWorkspace: () => void;
  onOpenDocument: (entry: DirectoryEntry) => void;
  onToggleDirectory: (entry: DirectoryEntry) => void;
}

interface DirectoryBranchProps {
  activePath: string | null;
  depth: number;
  directoryPath: string;
  entriesByDirectory: Readonly<Record<string, readonly DirectoryEntry[]>>;
  expandedPaths: ReadonlySet<string>;
  loadingPaths: ReadonlySet<string>;
  onOpenDocument: (entry: DirectoryEntry) => void;
  onToggleDirectory: (entry: DirectoryEntry) => void;
}

const DirectoryBranch = memo(function DirectoryBranch({
  activePath,
  depth,
  directoryPath,
  entriesByDirectory,
  expandedPaths,
  loadingPaths,
  onOpenDocument,
  onToggleDirectory,
}: DirectoryBranchProps) {
  const entries = entriesByDirectory[directoryPath] ?? [];

  return (
    <>
      {entries.map((entry) => {
        const isDirectory = entry.kind === "directory";
        const isExpanded = isDirectory && expandedPaths.has(entry.path);
        const isLoading = isDirectory && loadingPaths.has(entry.path);

        return (
          <div className="file-tree-node" key={entry.path}>
            <button
              className={`file-tree-row ${
                activePath === entry.path ? "is-active" : ""
              }`}
              onClick={() => {
                if (isDirectory) {
                  onToggleDirectory(entry);
                } else {
                  onOpenDocument(entry);
                }
              }}
              style={{ paddingInlineStart: 12 + depth * 16 }}
              title={entry.path}
              type="button"
            >
              {isDirectory ? (
                <Icon
                  className={`file-tree-chevron ${
                    isExpanded ? "is-expanded" : ""
                  }`}
                  name="chevron"
                />
              ) : (
                <span className="file-tree-chevron-spacer" />
              )}
              <Icon
                className="file-tree-kind"
                name={
                  isDirectory
                    ? isExpanded
                      ? "folderOpen"
                      : "folder"
                    : "document"
                }
              />
              <span className="file-tree-name">{entry.name}</span>
              {isLoading ? <span className="file-tree-loader" /> : null}
            </button>

            {isExpanded ? (
              <DirectoryBranch
                activePath={activePath}
                depth={depth + 1}
                directoryPath={entry.path}
                entriesByDirectory={entriesByDirectory}
                expandedPaths={expandedPaths}
                loadingPaths={loadingPaths}
                onOpenDocument={onOpenDocument}
                onToggleDirectory={onToggleDirectory}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
});

export const FileSidebar = memo(function FileSidebar({
  activePath,
  entriesByDirectory,
  expandedPaths,
  isVisible,
  loadingPaths,
  workspace,
  onOpenWorkspace,
  onOpenDocument,
  onToggleDirectory,
}: FileSidebarProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <aside className="file-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">工作区</span>
          <strong>{workspace?.rootName ?? "尚未选择"}</strong>
        </div>
        <button
          aria-label="打开工作区"
          className="icon-button compact"
          onClick={onOpenWorkspace}
          title="打开工作区 (⇧⌘O)"
          type="button"
        >
          <Icon name="open" />
        </button>
      </div>

      <div className="file-tree" role="tree">
        {workspace ? (
          <DirectoryBranch
            activePath={activePath}
            depth={0}
            directoryPath={workspace.rootPath}
            entriesByDirectory={entriesByDirectory}
            expandedPaths={expandedPaths}
            loadingPaths={loadingPaths}
            onOpenDocument={onOpenDocument}
            onToggleDirectory={onToggleDirectory}
          />
        ) : (
          <div className="sidebar-empty">
            <span className="sidebar-empty-mark">⌁</span>
            <p>选择一个文件夹，在这里浏览 Markdown 文稿。</p>
            <button
              className="text-button"
              onClick={onOpenWorkspace}
              type="button"
            >
              选择文件夹
            </button>
          </div>
        )}
      </div>
    </aside>
  );
});
