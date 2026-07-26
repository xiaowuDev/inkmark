import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AiConfiguration,
  AiMessage,
  AiRequestContext,
  AiStreamChunk,
  ChatReceipt,
  KnowledgeGraph,
  WorkspaceAiSource,
  WorkspaceEntry,
} from "./types";

interface ChatCommandRequest {
  requestId: string;
  rootPath: string | null;
  activePath: string | null;
  activeContent: string | null;
  scopePaths: string[];
  selection: string | null;
  messages: Pick<AiMessage, "role" | "content">[];
}

interface KnowledgeGraphCommandRequest {
  rootPath: string;
  activePath: string | null;
  activeContent: string | null;
}

export function getAiConfiguration(): Promise<AiConfiguration> {
  return invoke<AiConfiguration>("get_ai_configuration");
}

export function saveDeepSeekApiKey(apiKey: string): Promise<AiConfiguration> {
  return invoke<AiConfiguration>("save_deepseek_api_key", { apiKey });
}

export function deleteDeepSeekApiKey(): Promise<AiConfiguration> {
  return invoke<AiConfiguration>("delete_deepseek_api_key");
}

export function testDeepSeekConnection(): Promise<void> {
  return invoke<null>("test_deepseek_connection").then(() => undefined);
}

export function chatWithWorkspace(
  requestId: string,
  source: WorkspaceAiSource,
  messages: readonly AiMessage[],
  context: AiRequestContext,
): Promise<ChatReceipt> {
  const request: ChatCommandRequest = {
    requestId,
    rootPath: source.rootPath,
    activePath: source.activePath,
    activeContent: source.activeContent,
    scopePaths: [...context.scopePaths],
    selection: context.selection,
    messages: messages.map(({ role, content }) => ({ role, content })),
  };
  return invoke<ChatReceipt>("chat_with_workspace", { request });
}

export function listWorkspaceEntries(
  rootPath: string,
): Promise<WorkspaceEntry[]> {
  return invoke<WorkspaceEntry[]>("list_workspace_entries", { rootPath });
}

export function cancelAiChat(requestId: string): Promise<void> {
  return invoke<null>("cancel_ai_chat", { requestId }).then(() => undefined);
}

export function buildKnowledgeGraph(
  source: WorkspaceAiSource & { rootPath: string },
): Promise<KnowledgeGraph> {
  const request: KnowledgeGraphCommandRequest = {
    rootPath: source.rootPath,
    activePath: source.activePath,
    activeContent: source.activeContent,
  };
  return invoke<KnowledgeGraph>("build_knowledge_graph", { request });
}

export function listenForAiChunks(
  onChunk: (chunk: AiStreamChunk) => void,
): Promise<UnlistenFn> {
  return listen<AiStreamChunk>("inkmark://ai-chat-chunk", (event) => {
    onChunk(event.payload);
  });
}
