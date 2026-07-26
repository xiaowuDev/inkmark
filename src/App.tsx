import { lazy, Suspense, useState } from "react";

import { EditorTabs } from "./components/EditorTabs";
import { FileSidebar } from "./components/FileSidebar";
import { Icon } from "./components/Icon";
import { Welcome } from "./components/Welcome";
import { useAutomaticUpdater } from "./hooks/use-automatic-updater";
import { useWorkspaceController } from "./hooks/use-workspace-controller";
import { printMarkdownAsPdf } from "./lib/pdf-export";
import "./styles/app.css";

const MarkdownEditor = lazy(() =>
  import("./components/MarkdownEditor").then((module) => ({
    default: module.MarkdownEditor,
  })),
);

function App() {
  const controller = useWorkspaceController();
  const { activeTab } = controller;
  const automaticUpdate = useAutomaticUpdater({
    canRelaunch: controller.tabs.length === 0,
  });
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

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
      }`}
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
          aria-label={controller.isDarkMode ? "切换浅色模式" : "切换深色模式"}
          className="icon-button theme-button"
          onClick={controller.toggleTheme}
          title={controller.isDarkMode ? "浅色模式" : "深色模式"}
          type="button"
        >
          <Icon name={controller.isDarkMode ? "sun" : "moon"} />
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
                  isDarkMode={controller.isDarkMode}
                  onChange={controller.handleEditorChange}
                  onReady={() => undefined}
                />
              </Suspense>
            )}
          </div>
        </section>
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
