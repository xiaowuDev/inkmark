export interface AiConfiguration {
  isConfigured: boolean;
  model: string;
  provider: string;
}

export type AiMessageRole = "user" | "assistant";

export interface AiMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  errorMessage: string | null;
}

export interface AiStreamChunk {
  requestId: string;
  delta: string;
  isDone: boolean;
}

export interface WorkspaceContextSummary {
  workspaceName: string;
  discoveredFileCount: number;
  includedFileCount: number;
  truncatedFileCount: number;
  omittedFileCount: number;
  contextBytes: number;
}

export interface ChatReceipt {
  content: string;
  context: WorkspaceContextSummary;
  model: string;
  wasCancelled: boolean;
}

export type KnowledgeNodeKind =
  "document" | "concept" | "person" | "project" | "topic";

export interface KnowledgeNode {
  id: string;
  label: string;
  kind: KnowledgeNodeKind;
  path: string | null;
  summary: string;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface KnowledgeGraph {
  overview: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  context: WorkspaceContextSummary;
  generatedAtMs: number;
  model: string;
}

export interface WorkspaceAiSource {
  rootPath: string | null;
  activePath: string | null;
  activeContent: string | null;
}

export interface PositionedKnowledgeNode extends KnowledgeNode {
  x: number;
  y: number;
  radius: number;
}
