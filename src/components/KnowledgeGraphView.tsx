import { useMemo, useState } from "react";

import { layoutKnowledgeGraph } from "../ai/graph-layout";
import { formatContextBytes } from "../ai/message-utils";
import type {
  AiConfiguration,
  KnowledgeGraph,
  PositionedKnowledgeNode,
} from "../ai/types";
import { Icon } from "./Icon";

const GRAPH_WIDTH = 340;
const GRAPH_HEIGHT = 360;

interface KnowledgeGraphViewProps {
  configuration: AiConfiguration | null;
  errorMessage: string | null;
  graph: KnowledgeGraph | null;
  isBuilding: boolean;
  workspaceName: string | null;
  workspaceRootPath: string | null;
  onBuild: () => Promise<void>;
  onOpenNode: (relativePath: string) => void;
  onOpenSettings: () => void;
}

function nodeColor(node: PositionedKnowledgeNode): string {
  switch (node.kind) {
    case "document":
      return "#0969da";
    case "person":
      return "#8250df";
    case "project":
      return "#1a7f37";
    case "topic":
      return "#bc4c00";
    default:
      return "#57606a";
  }
}

function shortLabel(label: string): string {
  return label.length > 12 ? `${label.slice(0, 11)}…` : label;
}

export function KnowledgeGraphView({
  configuration,
  errorMessage,
  graph,
  isBuilding,
  workspaceName,
  workspaceRootPath,
  onBuild,
  onOpenNode,
  onOpenSettings,
}: KnowledgeGraphViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const positionedNodes = useMemo(
    () => (graph ? layoutKnowledgeGraph(graph, GRAPH_WIDTH, GRAPH_HEIGHT) : []),
    [graph],
  );
  const nodesById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );
  const selectedNode =
    positionedNodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedNodePath = selectedNode?.path ?? null;

  if (!configuration?.isConfigured) {
    return (
      <div className="ai-empty-state">
        <span className="ai-orbit-mark is-graph">
          <Icon name="graph" />
        </span>
        <h3>AI 知识神经网络</h3>
        <p>DeepSeek 会识别文档、人物、项目和主题，并自动连接它们之间的关系。</p>
        <button
          className="ai-primary-action"
          onClick={onOpenSettings}
          type="button"
        >
          <Icon name="key" />
          配置后构建
        </button>
      </div>
    );
  }

  if (!workspaceRootPath) {
    return (
      <div className="ai-empty-state">
        <span className="ai-orbit-mark is-graph">
          <Icon name="folderOpen" />
        </span>
        <h3>先打开一个工作区</h3>
        <p>
          知识网络需要跨文件分析，因此必须先选择包含 Markdown 文稿的文件夹。
        </p>
      </div>
    );
  }

  return (
    <div className="knowledge-graph-view">
      <div className="knowledge-graph-summary">
        <div>
          <span className="eyebrow">AI KNOWLEDGE MAP</span>
          <strong>{workspaceName}</strong>
        </div>
        <button
          className="ai-icon-action"
          disabled={isBuilding}
          onClick={() => {
            void onBuild();
          }}
          title={graph ? "重新构建知识网络" : "构建知识网络"}
          type="button"
        >
          <Icon name="refresh" />
        </button>
      </div>

      {graph ? (
        <>
          <div className="knowledge-canvas">
            <svg
              aria-label={`${workspaceName ?? "工作区"}知识网络`}
              role="img"
              viewBox={[
                "0",
                "0",
                String(GRAPH_WIDTH),
                String(GRAPH_HEIGHT),
              ].join(" ")}
            >
              <defs>
                <pattern
                  height="18"
                  id="graph-grid"
                  patternUnits="userSpaceOnUse"
                  width="18"
                >
                  <circle cx="1" cy="1" fill="#d8dee4" r="0.65" />
                </pattern>
              </defs>
              <rect
                fill="url(#graph-grid)"
                height={GRAPH_HEIGHT}
                width={GRAPH_WIDTH}
              />
              <g className="knowledge-edges">
                {graph.edges.map((edge, index) => {
                  const source = nodesById.get(edge.source);
                  const target = nodesById.get(edge.target);
                  if (!source || !target) {
                    return null;
                  }
                  return (
                    <line
                      key={`${edge.source}-${edge.target}-${String(index)}`}
                      opacity={0.18 + edge.weight * 0.46}
                      strokeWidth={0.6 + edge.weight * 1.4}
                      x1={source.x}
                      x2={target.x}
                      y1={source.y}
                      y2={target.y}
                    />
                  );
                })}
              </g>
              <g className="knowledge-nodes">
                {positionedNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <g
                      aria-label={`${node.label}，${node.kind}`}
                      className={isSelected ? "is-selected" : ""}
                      key={node.id}
                      onClick={() => {
                        setSelectedNodeId(node.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedNodeId(node.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      transform={[
                        "translate(",
                        String(node.x),
                        " ",
                        String(node.y),
                        ")",
                      ].join("")}
                    >
                      <circle
                        fill={nodeColor(node)}
                        r={node.radius + (isSelected ? 3 : 0)}
                      />
                      <circle
                        className="node-core"
                        fill="#ffffff"
                        r={Math.max(2, node.radius * 0.32)}
                      />
                      <text y={node.radius + 13}>{shortLabel(node.label)}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          <p className="knowledge-overview">{graph.overview}</p>
          {selectedNode ? (
            <div className="knowledge-node-card">
              <span
                className="knowledge-node-kind"
                style={{ color: nodeColor(selectedNode) }}
              >
                {selectedNode.kind}
              </span>
              <strong>{selectedNode.label}</strong>
              <p>{selectedNode.summary}</p>
              {selectedNodePath ? (
                <button
                  onClick={() => {
                    onOpenNode(selectedNodePath);
                  }}
                  type="button"
                >
                  <Icon name="document" />
                  打开 {selectedNodePath}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="knowledge-hint">选择节点查看摘要与来源文档</p>
          )}
          <div className="knowledge-meta">
            <span>{graph.nodes.length} 个节点</span>
            <span>{graph.edges.length} 条关系</span>
            <span>
              {graph.context.includedFileCount} 个文件 ·{" "}
              {formatContextBytes(graph.context.contextBytes)}
            </span>
          </div>
        </>
      ) : (
        <div className="knowledge-build-empty">
          <div className="network-preview" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <h3>把散落的文稿连成网络</h3>
          <p>
            DeepSeek 将读取 {workspaceName}
            中的可读文本，提取关键概念并自动建立关系。
          </p>
          <button
            className="ai-primary-action"
            disabled={isBuilding}
            onClick={() => {
              void onBuild();
            }}
            type="button"
          >
            {isBuilding ? (
              <span className="ink-loader" />
            ) : (
              <Icon name="graph" />
            )}
            {isBuilding ? "正在构建网络…" : "AI 自动构建"}
          </button>
        </div>
      )}

      {isBuilding && graph ? (
        <div className="knowledge-building-overlay">
          <span className="ink-loader" />
          正在重新分析工作区…
        </div>
      ) : null}
      {errorMessage ? (
        <p className="knowledge-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
