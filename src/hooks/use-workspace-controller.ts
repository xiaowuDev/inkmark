import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  DirectoryEntry,
  DocumentStats,
  EditorTab,
  Workspace,
} from "../domain";
import {
  chooseDocument,
  chooseSavePath,
  chooseWorkspaceDirectory,
  listDirectory,
  readDocument,
  writeDocument,
} from "../lib/desktop";
import {
  countDocumentStats,
  directoryNameFromPath,
  fileNameFromPath,
  nextUntitledName,
  selectTabAfterClose,
} from "../lib/document-utils";

const AUTOSAVE_DELAY_MS = 700;
const STATS_DELAY_MS = 140;
const EMPTY_STATS = countDocumentStats("");

function newTab(
  name: string,
  path: string | null,
  isLoading: boolean,
): EditorTab {
  return {
    id: crypto.randomUUID(),
    name,
    path,
    isDirty: false,
    isLoading,
    saveState: "idle",
    errorMessage: null,
  };
}

function defaultSavePath(workspace: Workspace | null, tabName: string): string {
  const fileName = tabName.endsWith(".md") ? tabName : `${tabName}.md`;
  return workspace ? `${workspace.rootPath}/${fileName}` : fileName;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useWorkspaceController() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [entriesByDirectory, setEntriesByDirectory] = useState<
    Record<string, readonly DirectoryEntry[]>
  >({});
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [loadingPaths, setLoadingPaths] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [documentStats, setDocumentStats] =
    useState<DocumentStats>(EMPTY_STATS);
  const [activeDocumentValue, setActiveDocumentValue] = useState("");
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const draftsRef = useRef(new Map<string, string>());
  const dirtyTabsRef = useRef(new Set<string>());
  const autosaveTimersRef = useRef(new Map<string, number>());
  const statsTimerRef = useRef<number | null>(null);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const workspaceRef = useRef(workspace);
  const saveQueueRef = useRef(new Map<string, Promise<boolean>>());

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const updateTab = useCallback((tabId: string, update: Partial<EditorTab>) => {
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, ...update } : tab)),
    );
  }, []);

  const saveTab = useCallback(
    async (tabId: string, allowPathSelection = true): Promise<boolean> => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
      if (!tab || tab.isLoading) {
        return false;
      }

      const contents = draftsRef.current.get(tabId) ?? "";
      let targetPath = tab.path;

      if (!targetPath && allowPathSelection) {
        targetPath = await chooseSavePath(
          defaultSavePath(workspaceRef.current, tab.name),
        );
      }

      if (!targetPath) {
        return false;
      }

      const previousSave =
        saveQueueRef.current.get(tabId) ?? Promise.resolve(true);
      const queuedSave = previousSave
        .catch(() => false)
        .then(async () => {
          updateTab(tabId, {
            errorMessage: null,
            saveState: "saving",
          });

          try {
            await writeDocument(targetPath, contents);
            const hasNewerChanges = draftsRef.current.get(tabId) !== contents;

            if (!hasNewerChanges) {
              dirtyTabsRef.current.delete(tabId);
            }

            updateTab(tabId, {
              errorMessage: null,
              isDirty: hasNewerChanges,
              name: fileNameFromPath(targetPath),
              path: targetPath,
              saveState: "saved",
            });
            return true;
          } catch (error) {
            updateTab(tabId, {
              errorMessage: errorMessage(error),
              saveState: "error",
            });
            return false;
          }
        });

      saveQueueRef.current.set(tabId, queuedSave);
      const didSave = await queuedSave;
      if (saveQueueRef.current.get(tabId) === queuedSave) {
        saveQueueRef.current.delete(tabId);
      }
      return didSave;
    },
    [updateTab],
  );

  const scheduleAutosave = useCallback(
    (tabId: string) => {
      const existingTimer = autosaveTimersRef.current.get(tabId);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }

      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
      if (!tab?.path) {
        return;
      }

      const timer = window.setTimeout(() => {
        autosaveTimersRef.current.delete(tabId);
        void saveTab(tabId, false);
      }, AUTOSAVE_DELAY_MS);
      autosaveTimersRef.current.set(tabId, timer);
    },
    [saveTab],
  );

  const loadDirectory = useCallback(async (path: string) => {
    setLoadingPaths((current) => new Set(current).add(path));
    try {
      const entries = await listDirectory(path);
      setEntriesByDirectory((current) => ({
        ...current,
        [path]: entries,
      }));
    } finally {
      setLoadingPaths((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
  }, []);

  const openWorkspace = useCallback(async () => {
    const rootPath = await chooseWorkspaceDirectory();
    if (!rootPath) {
      return;
    }

    const nextWorkspace = {
      rootPath,
      rootName: directoryNameFromPath(rootPath),
    };
    setWorkspace(nextWorkspace);
    setEntriesByDirectory({});
    setExpandedPaths(new Set());
    await loadDirectory(rootPath);
  }, [loadDirectory]);

  const openPath = useCallback(
    async (path: string, name = fileNameFromPath(path)) => {
      const existingTab = tabsRef.current.find((tab) => tab.path === path);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        setActiveDocumentValue(draftsRef.current.get(existingTab.id) ?? "");
        setDocumentStats(
          countDocumentStats(draftsRef.current.get(existingTab.id) ?? ""),
        );
        return;
      }

      const tab = newTab(name, path, true);
      setTabs((current) => [...current, tab]);
      setActiveTabId(tab.id);

      try {
        const contents = await readDocument(path);
        draftsRef.current.set(tab.id, contents);
        updateTab(tab.id, { isLoading: false });
        setActiveDocumentValue(contents);
        setDocumentStats(countDocumentStats(contents));
      } catch (error) {
        updateTab(tab.id, {
          errorMessage: errorMessage(error),
          isLoading: false,
          saveState: "error",
        });
      }
    },
    [updateTab],
  );

  const openDocument = useCallback(async () => {
    const path = await chooseDocument();
    if (path) {
      await openPath(path);
    }
  }, [openPath]);

  const createDocument = useCallback(() => {
    const tab = newTab(nextUntitledName(tabsRef.current), null, false);
    draftsRef.current.set(tab.id, "");
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setActiveDocumentValue("");
    setDocumentStats(EMPTY_STATS);
  }, []);

  const activateTab = useCallback(
    (tabId: string) => {
      const previousTabId = activeTabIdRef.current;
      if (previousTabId === tabId) {
        return;
      }

      if (previousTabId && dirtyTabsRef.current.has(previousTabId)) {
        void saveTab(previousTabId, false);
      }

      startTransition(() => {
        setActiveTabId(tabId);
        setActiveDocumentValue(draftsRef.current.get(tabId) ?? "");
        setDocumentStats(
          countDocumentStats(draftsRef.current.get(tabId) ?? ""),
        );
      });
    },
    [saveTab],
  );

  const closeTab = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
      if (!tab) {
        return;
      }

      if (dirtyTabsRef.current.has(tabId)) {
        const didSave = await saveTab(tabId, true);
        if (!didSave) {
          return;
        }
      }

      const currentTabs = tabsRef.current;
      const nextActiveTabId = selectTabAfterClose(
        currentTabs,
        activeTabIdRef.current,
        tabId,
      );
      const timer = autosaveTimersRef.current.get(tabId);
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      autosaveTimersRef.current.delete(tabId);
      draftsRef.current.delete(tabId);
      dirtyTabsRef.current.delete(tabId);
      setTabs((current) =>
        current.filter((candidate) => candidate.id !== tabId),
      );
      setActiveTabId(nextActiveTabId);
      setActiveDocumentValue(
        nextActiveTabId ? (draftsRef.current.get(nextActiveTabId) ?? "") : "",
      );
      setDocumentStats(
        nextActiveTabId
          ? countDocumentStats(draftsRef.current.get(nextActiveTabId) ?? "")
          : EMPTY_STATS,
      );
    },
    [saveTab],
  );

  const handleEditorChange = useCallback(
    (value: string) => {
      const tabId = activeTabIdRef.current;
      if (!tabId) {
        return;
      }

      draftsRef.current.set(tabId, value);
      if (!dirtyTabsRef.current.has(tabId)) {
        dirtyTabsRef.current.add(tabId);
        updateTab(tabId, { isDirty: true, saveState: "idle" });
      }

      if (statsTimerRef.current !== null) {
        window.clearTimeout(statsTimerRef.current);
      }
      statsTimerRef.current = window.setTimeout(() => {
        setDocumentStats(countDocumentStats(value));
      }, STATS_DELAY_MS);

      scheduleAutosave(tabId);
    },
    [scheduleAutosave, updateTab],
  );

  const toggleDirectory = useCallback(
    (entry: DirectoryEntry) => {
      const willExpand = !expandedPaths.has(entry.path);
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(entry.path)) {
          next.delete(entry.path);
        } else {
          next.add(entry.path);
        }
        return next;
      });

      if (willExpand && !entriesByDirectory[entry.path]) {
        void loadDirectory(entry.path);
      }
    },
    [entriesByDirectory, expandedPaths, loadDirectory],
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((current) => !current);
  }, []);

  const saveActiveDocument = useCallback(() => {
    const tabId = activeTabIdRef.current;
    if (tabId) {
      void saveTab(tabId, true);
    }
  }, [saveTab]);

  const getActiveDocumentValue = useCallback((): string | null => {
    const tabId = activeTabIdRef.current;
    return tabId ? (draftsRef.current.get(tabId) ?? "") : null;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        saveActiveDocument();
      } else if (key === "n") {
        event.preventDefault();
        createDocument();
      } else if (key === "o" && event.shiftKey) {
        event.preventDefault();
        void openWorkspace();
      } else if (key === "o") {
        event.preventDefault();
        void openDocument();
      } else if (key === "w" && activeTabIdRef.current) {
        event.preventDefault();
        void closeTab(activeTabIdRef.current);
      } else if (key === "\\") {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeTab,
    createDocument,
    openDocument,
    openWorkspace,
    saveActiveDocument,
    toggleSidebar,
  ]);

  useEffect(
    () => () => {
      autosaveTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      if (statsTimerRef.current !== null) {
        window.clearTimeout(statsTimerRef.current);
      }
    },
    [],
  );

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );

  return {
    activeDocumentValue,
    activeTab,
    activeTabId,
    activateTab,
    closeTab,
    createDocument,
    documentStats,
    entriesByDirectory,
    expandedPaths,
    getActiveDocumentValue,
    handleEditorChange,
    isSidebarVisible,
    loadingPaths,
    openDocument,
    openPath,
    openWorkspace,
    saveActiveDocument,
    tabs,
    toggleDirectory,
    toggleSidebar,
    workspace,
  };
}
