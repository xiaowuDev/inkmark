import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AiQuickTask,
  WorkspaceAiSource,
  WorkspaceEntry,
} from "../ai/types";
import { useAiAssistant } from "../ai/use-ai-assistant";
import { AiChat } from "./AiChat";
import { AiSettings } from "./AiSettings";
import { Icon } from "./Icon";
import { KnowledgeGraphView } from "./KnowledgeGraphView";

type AiPanelView = "chat" | "graph" | "settings";

interface AiPanelProps {
  activeDocumentName: string | null;
  canWriteBack: boolean;
  getSource: () => WorkspaceAiSource;
  isVisible: boolean;
  quickTask: AiQuickTask | null;
  workspaceName: string | null;
  workspaceRootPath: string | null;
  onClose: () => void;
  onInsertIntoDocument: (text: string) => void;
  onOpenReference: (relativePath: string) => void;
  onReplaceSelection: (text: string) => void;
}

export function AiPanel({
  activeDocumentName,
  canWriteBack,
  getSource,
  isVisible,
  quickTask,
  workspaceName,
  workspaceRootPath,
  onClose,
  onInsertIntoDocument,
  onOpenReference,
  onReplaceSelection,
}: AiPanelProps) {
  const [view, setView] = useState<AiPanelView>("chat");
  const [mentionState, setMentionState] = useState<{
    rootPath: string | null;
    entries: readonly WorkspaceEntry[];
  }>({ rootPath: workspaceRootPath, entries: [] });
  // 换工作区后旧的 `@` 范围立即失效，用派生状态避免额外一轮渲染。
  const mentions =
    mentionState.rootPath === workspaceRootPath ? mentionState.entries : [];
  const setMentions = useCallback(
    (entries: readonly WorkspaceEntry[]) => {
      setMentionState({ rootPath: workspaceRootPath, entries });
    },
    [workspaceRootPath],
  );
  const assistant = useAiAssistant({ getSource, workspaceRootPath });
  const handledQuickTaskRef = useRef<number>(0);
  const sendMessage = assistant.sendMessage;
  const autoBuiltWorkspaceRef = useRef<string | null>(null);
  const isConfigured = assistant.configuration?.isConfigured ?? false;
  const graph = assistant.graph;
  const graphError = assistant.graphError;
  const isBuildingGraph = assistant.isBuildingGraph;
  const generateGraph = assistant.generateGraph;

  // 编辑器发来的快捷动作：切到对话视图，用选中片段和当前文件范围直接提问。
  useEffect(() => {
    if (!quickTask || handledQuickTaskRef.current === quickTask.id) {
      return;
    }
    handledQuickTaskRef.current = quickTask.id;
    setView("chat");
    void sendMessage(quickTask.prompt, {
      scopePaths: quickTask.scopePath ? [quickTask.scopePath] : [],
      selection: quickTask.selection,
    });
  }, [quickTask, sendMessage]);

  useEffect(() => {
    if (
      view !== "graph" ||
      !isVisible ||
      !workspaceRootPath ||
      !isConfigured ||
      graph ||
      isBuildingGraph ||
      graphError ||
      autoBuiltWorkspaceRef.current === workspaceRootPath
    ) {
      return;
    }
    autoBuiltWorkspaceRef.current = workspaceRootPath;
    void generateGraph();
  }, [
    generateGraph,
    graph,
    graphError,
    isBuildingGraph,
    isConfigured,
    isVisible,
    view,
    workspaceRootPath,
  ]);

  return (
    <aside
      aria-hidden={!isVisible}
      className={`ai-panel ${isVisible ? "is-visible" : ""}`}
    >
      <header className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-title-mark">
            <Icon name="ai" />
          </span>
          <div>
            <strong>DeepSeek</strong>
            <span>工作区知识助手</span>
          </div>
        </div>
        <button
          aria-label="关闭 AI 面板"
          className="ai-icon-action"
          onClick={onClose}
          title="关闭 AI 面板 (⇧⌘I)"
          type="button"
        >
          <Icon name="close" />
        </button>
      </header>

      <nav aria-label="AI 功能" className="ai-panel-tabs">
        <button
          aria-current={view === "chat" ? "page" : undefined}
          className={view === "chat" ? "is-active" : ""}
          onClick={() => {
            setView("chat");
          }}
          type="button"
        >
          <Icon name="chat" />
          对话
        </button>
        <button
          aria-current={view === "graph" ? "page" : undefined}
          className={view === "graph" ? "is-active" : ""}
          onClick={() => {
            setView("graph");
          }}
          type="button"
        >
          <Icon name="graph" />
          知识网络
        </button>
        <button
          aria-label="AI 设置"
          aria-current={view === "settings" ? "page" : undefined}
          className={view === "settings" ? "is-active" : ""}
          onClick={() => {
            setView("settings");
          }}
          title="AI 设置"
          type="button"
        >
          <Icon name="settings" />
        </button>
      </nav>

      <div className="ai-panel-content">
        {view === "chat" ? (
          <AiChat
            activeDocumentName={activeDocumentName}
            canWriteBack={canWriteBack}
            configuration={assistant.configuration}
            isSending={assistant.isSending}
            lastReceipt={assistant.lastReceipt}
            mentions={mentions}
            messages={assistant.messages}
            onClear={assistant.clearMessages}
            onInsertIntoDocument={onInsertIntoDocument}
            onMentionsChange={setMentions}
            onOpenReference={onOpenReference}
            onReplaceSelection={onReplaceSelection}
            onOpenSettings={() => {
              setView("settings");
            }}
            onRetry={assistant.retryAssistantMessage}
            onSend={(question) =>
              sendMessage(question, {
                scopePaths: mentions.map((mention) => mention.path),
                selection: null,
              })
            }
            onStop={assistant.stopGeneration}
            workspaceName={workspaceName}
            workspaceRootPath={workspaceRootPath}
          />
        ) : null}
        {view === "graph" ? (
          <KnowledgeGraphView
            configuration={assistant.configuration}
            errorMessage={assistant.graphError}
            graph={assistant.graph}
            isBuilding={assistant.isBuildingGraph}
            onBuild={assistant.generateGraph}
            onOpenNode={onOpenReference}
            onOpenSettings={() => {
              setView("settings");
            }}
            workspaceName={workspaceName}
            workspaceRootPath={workspaceRootPath}
          />
        ) : null}
        {view === "settings" ? (
          <AiSettings
            configuration={assistant.configuration}
            configurationError={assistant.configurationError}
            onDelete={assistant.removeApiKey}
            onSave={assistant.saveApiKey}
            onTest={assistant.testConnection}
          />
        ) : null}
      </div>
    </aside>
  );
}
