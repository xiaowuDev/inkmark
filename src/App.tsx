import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { SelectionAction } from "./ai/selection-actions";
import type { AiQuickTask, WorkspaceAiSource } from "./ai/types";
import { EditorTabs } from "./components/EditorTabs";
import { FileSidebar } from "./components/FileSidebar";
import { Icon } from "./components/Icon";
import type { EditorWriteBack } from "./components/MarkdownEditor";
import { PaneResizer } from "./components/PaneResizer";

import { Welcome } from "./components/Welcome";
import { useAutomaticUpdater } from "./hooks/use-automatic-updater";
import {
  AI_PANEL_MAX_WIDTH,
  AI_PANEL_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  usePaneWidths,
} from "./hooks/use-pane-widths";
import { useWorkspaceController } from "./hooks/use-workspace-controller";
import { printMarkdownAsPdf } from "./lib/pdf-export";
import "./styles/app.css";

const MarkdownEditor = lazy(() =>
  import("./components/MarkdownEditor").then((module) => ({
    default: module.MarkdownEditor,
  })),
);

const AiPanel = lazy(() =>
  import("./components/AiPanel").then((module) => ({
    default: module.AiPanel,
  })),
);

function App() {
  const controller = useWorkspaceController();
  const { activeTab } = controller;
  const activePath = activeTab?.path ?? null;
  const getActiveDocumentValue = controller.getActiveDocumentValue;
  const openPath = controller.openPath;
  const workspaceRootPath = controller.workspace?.rootPath ?? null;
  const automaticUpdate = useAutomaticUpdater({
    canRelaunch: controller.tabs.length === 0,
  });
  const paneWidths = usePaneWidths();
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [isAiPanelVisible, setIsAiPanelVisible] = useState(false);
  const [hasOpenedAiPanel, setHasOpenedAiPanel] = useState(false);
  const [quickTask, setQuickTask] = useState<AiQuickTask | null>(null);
  const [canWriteBack, setCanWriteBack] = useState(false);
  const writeBackRef = useRef<EditorWriteBack | null>(null);

  const registerWriteBack = useCallback((writeBack: EditorWriteBack | null) => {
    writeBackRef.current = writeBack;
    setCanWriteBack(writeBack !== null);
  }, []);

  const relativeActivePath = useMemo(() => {
    if (!activePath || !workspaceRootPath) {
      return null;
    }
    const prefix = `${workspaceRootPath}/`;
    return activePath.startsWith(prefix)
      ? activePath.slice(prefix.length)
      : null;
  }, [activePath, workspaceRootPath]);

  const runSelectionAction = useCallback(
    (action: SelectionAction, selection: string) => {
      setHasOpenedAiPanel(true);
      setIsAiPanelVisible(true);
      setQuickTask((current) => ({
        id: (current?.id ?? 0) + 1,
        label: action.label,
        prompt: action.prompt,
        replaces: action.replaces,
        scopePath: relativeActivePath,
        selection,
      }));
    },
    [relativeActivePath],
  );

  const getAiSource = useCallback(
    (): WorkspaceAiSource => ({
      rootPath: workspaceRootPath,
      activePath,
      activeContent: getActiveDocumentValue(),
    }),
    [activePath, getActiveDocumentValue, workspaceRootPath],
  );

  const toggleAiPanel = useCallback(() => {
    setHasOpenedAiPanel(true);
    setIsAiPanelVisible((current) => !current);
  }, []);

  const openWorkspaceReference = useCallback(
    (relativePath: string) => {
      const normalizedPath = relativePath.replaceAll("\\", "/").trim();
      const segments = normalizedPath.split("/");
      if (
        !workspaceRootPath ||
        !normalizedPath ||
        normalizedPath.startsWith("/") ||
        segments.some((segment) => !segment || segment === "..")
      ) {
        return;
      }
      const name = segments.at(-1) ?? normalizedPath;
      void openPath(`${workspaceRootPath}/${normalizedPath}`, name);
    },
    [openPath, workspaceRootPath],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        toggleAiPanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleAiPanel]);

  async function exportActiveDocument() {
    const markdown = controller.getActiveDocumentValue();
    if (!activeTab || markdown === null) {
      return;
    }

    setPdfStatus("正在准备 PDF…");
    try {
      await printMarkdownAsPdf(markdown, activeTab.name);
      setPdfStatus(null);
    } catch {
      setPdfStatus("PDF 导出失败");
    }
  }

  return (
    <main
      className={`app-shell ${
        controller.isSidebarVisible ? "" : "sidebar-is-hidden"
      } ${isAiPanelVisible ? "ai-is-visible" : ""}`}
      style={
        {
          "--sidebar-width": `${String(paneWidths.sidebarWidth)}px`,
          "--ai-panel-width": `${String(paneWidths.aiPanelWidth)}px`,
        } as CSSProperties
      }
    >
      <header className="titlebar" data-tauri-drag-region>
        <div className="traffic-light-space" data-tauri-drag-region />
        <div className="brand" data-tauri-drag-region>
          <span className="brand-mark">墨</span>
          <span>InkMark</span>
        </div>
        <div className="toolbar" data-tauri-drag-region>
          <button
            aria-label="切换侧边栏"
            className="icon-button"
            onClick={controller.toggleSidebar}
            title="切换侧边栏 (⌘\\)"
            type="button"
          >
            <Icon name="sidebar" />
          </button>
          <span className="toolbar-divider" />
          <button
            aria-label="新建文稿"
            className="icon-button"
            onClick={controller.createDocument}
            title="新建文稿 (⌘N)"
            type="button"
          >
            <Icon name="new" />
          </button>
          <button
            aria-label="打开文稿"
            className="icon-button"
            onClick={() => {
              void controller.openDocument();
            }}
            title="打开文稿 (⌘O)"
            type="button"
          >
            <Icon name="open" />
          </button>
          <button
            aria-label="保存文稿"
            className="icon-button"
            disabled={!activeTab || activeTab.isLoading}
            onClick={controller.saveActiveDocument}
            title="保存文稿 (⌘S)"
            type="button"
          >
            <Icon name="save" />
          </button>
          <button
            aria-label="导出 PDF"
            className="icon-button"
            disabled={!activeTab || activeTab.isLoading || pdfStatus !== null}
            onClick={() => {
              void exportActiveDocument();
            }}
            title="导出 PDF"
            type="button"
          >
            <Icon name="export" />
          </button>
        </div>
        <div className="titlebar-document" data-tauri-drag-region>
          {activeTab?.name ?? "本地 Markdown 工作台"}
        </div>
        <button
          aria-label="切换 DeepSeek AI 面板"
          aria-pressed={isAiPanelVisible}
          className={`icon-button ai-toggle-button ${
            isAiPanelVisible ? "is-active" : ""
          }`}
          onClick={toggleAiPanel}
          title="DeepSeek AI (⇧⌘I)"
          type="button"
        >
          <Icon name="ai" />
        </button>
      </header>

      <div className="workspace-layout">
        <FileSidebar
          activePath={activeTab?.path ?? null}
          entriesByDirectory={controller.entriesByDirectory}
          expandedPaths={controller.expandedPaths}
          isVisible={controller.isSidebarVisible}
          loadingPaths={controller.loadingPaths}
          onOpenDocument={(entry) => {
            void controller.openPath(entry.path, entry.name);
          }}
          onOpenWorkspace={() => {
            void controller.openWorkspace();
          }}
          onToggleDirectory={controller.toggleDirectory}
          workspace={controller.workspace}
        />

        {controller.isSidebarVisible ? (
          <PaneResizer
            edge="left"
            label="侧边栏宽度"
            max={SIDEBAR_MAX_WIDTH}
            min={SIDEBAR_MIN_WIDTH}
            onChange={paneWidths.setSidebarWidth}
            onReset={paneWidths.resetSidebarWidth}
            width={paneWidths.sidebarWidth}
          />
        ) : null}

        <section
          className={`editor-workspace ${
            controller.tabs.length === 0 ? "is-empty" : ""
          }`}
        >
          {controller.tabs.length > 0 ? (
            <EditorTabs
              activeTabId={controller.activeTabId}
              onActivate={controller.activateTab}
              onClose={(tabId) => {
                void controller.closeTab(tabId);
              }}
              tabs={controller.tabs}
            />
          ) : null}

          <div className="editor-stage">
            {!activeTab ? (
              <Welcome
                onNewDocument={controller.createDocument}
                onOpenDocument={() => {
                  void controller.openDocument();
                }}
                onOpenWorkspace={() => {
                  void controller.openWorkspace();
                }}
              />
            ) : activeTab.isLoading ? (
              <div className="loading-document">
                <span className="ink-loader" />
                <p>正在打开 {activeTab.name}</p>
              </div>
            ) : activeTab.errorMessage ? (
              <div className="document-error">
                <span>无法打开文稿</span>
                <p>{activeTab.errorMessage}</p>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="loading-document">
                    <span className="ink-loader" />
                    <p>正在准备编辑器</p>
                  </div>
                }
              >
                <MarkdownEditor
                  documentId={activeTab.id}
                  initialValue={controller.activeDocumentValue}
                  onChange={controller.handleEditorChange}
                  onReady={() => undefined}
                  onSelectionAction={runSelectionAction}
                  registerWriteBack={registerWriteBack}
                />
              </Suspense>
            )}
          </div>
        </section>

        {isAiPanelVisible ? (
          <PaneResizer
            edge="right"
            label="AI 面板宽度"
            max={AI_PANEL_MAX_WIDTH}
            min={AI_PANEL_MIN_WIDTH}
            onChange={paneWidths.setAiPanelWidth}
            onReset={paneWidths.resetAiPanelWidth}
            width={paneWidths.aiPanelWidth}
          />
        ) : null}

        {hasOpenedAiPanel ? (
          <Suspense
            fallback={
              isAiPanelVisible ? (
                <aside className="ai-panel is-visible ai-panel-loading">
                  <span className="ink-loader" />
                  正在准备 DeepSeek…
                </aside>
              ) : null
            }
          >
            <AiPanel
              activeDocumentName={activeTab?.name ?? null}
              canWriteBack={canWriteBack}
              getSource={getAiSource}
              isVisible={isAiPanelVisible}
              onClose={() => {
                setIsAiPanelVisible(false);
              }}
              onInsertIntoDocument={(text) => {
                writeBackRef.current?.insertAtCursor(text);
              }}
              onOpenReference={openWorkspaceReference}
              onReplaceSelection={(text) => {
                writeBackRef.current?.replaceSelection(text);
              }}
              quickTask={quickTask}
              workspaceName={controller.workspace?.rootName ?? null}
              workspaceRootPath={controller.workspace?.rootPath ?? null}
            />
          </Suspense>
        ) : null}
      </div>

      <footer className="statusbar">
        <span>{controller.workspace?.rootPath ?? "未选择工作区"}</span>
        <div className="statusbar-right">
          {pdfStatus ? (
            <span className={pdfStatus.includes("失败") ? "error-state" : ""}>
              {pdfStatus}
            </span>
          ) : null}
          {automaticUpdate.message ? (
            <span
              className={
                automaticUpdate.phase === "error" ? "error-state" : undefined
              }
            >
              {automaticUpdate.message}
            </span>
          ) : null}
          {activeTab?.saveState === "saving" ? <span>正在保存…</span> : null}
          {activeTab?.saveState === "saved" && !activeTab.isDirty ? (
            <span className="saved-state">已保存</span>
          ) : null}
          {activeTab?.saveState === "error" ? (
            <span className="error-state">保存失败</span>
          ) : null}
          <span>{controller.documentStats.lines} 行</span>
          <span>{controller.documentStats.words} 字词</span>
          <span>{controller.documentStats.characters} 字符</span>
          <span>Markdown</span>
        </div>
      </footer>
    </main>
  );
}

export default App;
