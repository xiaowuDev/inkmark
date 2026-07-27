import {
  memo,
  useEffect,
  useState,
  type MouseEvent,
  type SyntheticEvent,
} from "react";

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
  onCreateDocument: (directoryPath: string, name: string) => Promise<void>;
  onToggleDirectory: (entry: DirectoryEntry) => void;
}

interface CreateMenuState {
  directoryPath: string;
  mode: "menu" | "name";
  x: number;
  y: number;
}

interface DirectoryBranchProps {
  activePath: string | null;
  depth: number;
  directoryPath: string;
  entriesByDirectory: Readonly<Record<string, readonly DirectoryEntry[]>>;
  expandedPaths: ReadonlySet<string>;
  loadingPaths: ReadonlySet<string>;
  onOpenDocument: (entry: DirectoryEntry) => void;
  onRequestCreate: (event: MouseEvent, directoryPath: string) => void;
  onToggleDirectory: (entry: DirectoryEntry) => void;
}

const CREATE_MENU_WIDTH = 210;
const CREATE_MENU_HEIGHT = 150;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const DirectoryBranch = memo(function DirectoryBranch({
  activePath,
  depth,
  directoryPath,
  entriesByDirectory,
  expandedPaths,
  loadingPaths,
  onOpenDocument,
  onRequestCreate,
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
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRequestCreate(
                  event,
                  isDirectory ? entry.path : directoryPath,
                );
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
                onRequestCreate={onRequestCreate}
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
  onCreateDocument,
  onToggleDirectory,
}: FileSidebarProps) {
  const [createMenu, setCreateMenu] = useState<CreateMenuState | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!createMenu) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".file-create-popover")) {
        return;
      }
      setCreateMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateMenu(null);
      }
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [createMenu]);

  const requestCreate = (event: MouseEvent, directoryPath: string) => {
    const maxX = Math.max(8, window.innerWidth - CREATE_MENU_WIDTH - 8);
    const maxY = Math.max(8, window.innerHeight - CREATE_MENU_HEIGHT - 8);
    setDocumentName("");
    setCreateError(null);
    setCreateMenu({
      directoryPath,
      mode: "menu",
      x: Math.min(event.clientX, maxX),
      y: Math.min(event.clientY, maxY),
    });
  };

  const submitCreate = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createMenu?.mode !== "name" || isCreating) {
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await onCreateDocument(createMenu.directoryPath, documentName);
      setCreateMenu(null);
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

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

      <div
        className="file-tree"
        onContextMenu={(event) => {
          if (workspace) {
            event.preventDefault();
            requestCreate(event, workspace.rootPath);
          }
        }}
        role="tree"
      >
        {workspace ? (
          <DirectoryBranch
            activePath={activePath}
            depth={0}
            directoryPath={workspace.rootPath}
            entriesByDirectory={entriesByDirectory}
            expandedPaths={expandedPaths}
            loadingPaths={loadingPaths}
            onOpenDocument={onOpenDocument}
            onRequestCreate={requestCreate}
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

      {createMenu ? (
        <div
          className="file-create-popover"
          role={createMenu.mode === "menu" ? "menu" : "dialog"}
          style={{ left: createMenu.x, top: createMenu.y }}
        >
          {createMenu.mode === "menu" ? (
            <button
              onClick={() => {
                setCreateMenu((current) =>
                  current ? { ...current, mode: "name" } : null,
                );
              }}
              role="menuitem"
              type="button"
            >
              <Icon name="new" />
              新建文件
            </button>
          ) : (
            <form onSubmit={(event) => void submitCreate(event)}>
              <label htmlFor="new-workspace-document">文件名</label>
              <input
                autoFocus
                disabled={isCreating}
                id="new-workspace-document"
                onChange={(event) => {
                  setDocumentName(event.target.value);
                  setCreateError(null);
                }}
                placeholder="例如：新文稿.md"
                spellCheck={false}
                value={documentName}
              />
              {createError ? (
                <p className="file-create-error">{createError}</p>
              ) : (
                <p className="file-create-hint">回车创建，Esc 取消</p>
              )}
            </form>
          )}
        </div>
      ) : null}
    </aside>
  );
});
