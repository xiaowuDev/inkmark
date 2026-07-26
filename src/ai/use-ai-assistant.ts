import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildKnowledgeGraph,
  chatWithWorkspace,
  deleteDeepSeekApiKey,
  getAiConfiguration,
  listenForAiChunks,
  saveDeepSeekApiKey,
  testDeepSeekConnection,
} from "./client";
import type {
  AiConfiguration,
  AiMessage,
  ChatReceipt,
  KnowledgeGraph,
  WorkspaceAiSource,
} from "./types";

const GRAPH_CACHE_VERSION = 1;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function graphCacheKey(rootPath: string): string {
  let hash = 2166136261;
  for (let index = 0; index < rootPath.length; index += 1) {
    hash ^= rootPath.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `inkmark.ai.graph.v${String(GRAPH_CACHE_VERSION)}.${(hash >>> 0).toString(16)}`;
}

function loadCachedGraph(rootPath: string | null): KnowledgeGraph | null {
  if (!rootPath) {
    return null;
  }
  const serialized = localStorage.getItem(graphCacheKey(rootPath));
  if (!serialized) {
    return null;
  }
  try {
    const graph = JSON.parse(serialized) as KnowledgeGraph;
    return Array.isArray(graph.nodes) &&
      Array.isArray(graph.edges) &&
      typeof graph.overview === "string"
      ? graph
      : null;
  } catch {
    return null;
  }
}

function cacheGraph(rootPath: string, graph: KnowledgeGraph): void {
  try {
    localStorage.setItem(graphCacheKey(rootPath), JSON.stringify(graph));
  } catch {
    // A full or unavailable webview store should not break graph generation.
  }
}

interface UseAiAssistantOptions {
  getSource: () => WorkspaceAiSource;
  workspaceRootPath: string | null;
}

export function useAiAssistant({
  getSource,
  workspaceRootPath,
}: UseAiAssistantOptions) {
  const [configuration, setConfiguration] = useState<AiConfiguration | null>(
    null,
  );
  const [configurationError, setConfigurationError] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ChatReceipt | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(() =>
    loadCachedGraph(workspaceRootPath),
  );
  const [isBuildingGraph, setIsBuildingGraph] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const pendingDeltasRef = useRef(new Map<string, string>());
  const flushFrameRef = useRef<number | null>(null);

  const flushStreamDeltas = useCallback(() => {
    flushFrameRef.current = null;
    const pending = pendingDeltasRef.current;
    if (pending.size === 0) {
      return;
    }
    pendingDeltasRef.current = new Map();
    setMessages((current) =>
      current.map((message) => {
        const delta = pending.get(message.id);
        return delta
          ? { ...message, content: message.content + delta }
          : message;
      }),
    );
  }, []);

  useEffect(() => {
    let isDisposed = false;
    void getAiConfiguration()
      .then((nextConfiguration) => {
        if (!isDisposed) {
          setConfiguration(nextConfiguration);
          setConfigurationError(null);
        }
      })
      .catch((error: unknown) => {
        if (!isDisposed) {
          setConfigurationError(errorMessage(error));
        }
      });
    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let isDisposed = false;
    void listenForAiChunks((chunk) => {
      if (isDisposed || !chunk.delta) {
        return;
      }
      pendingDeltasRef.current.set(
        chunk.requestId,
        (pendingDeltasRef.current.get(chunk.requestId) ?? "") + chunk.delta,
      );
      flushFrameRef.current ??= window.requestAnimationFrame(flushStreamDeltas);
    })
      .then((dispose) => {
        if (isDisposed) {
          dispose();
        } else {
          unlisten = dispose;
        }
      })
      .catch((error: unknown) => {
        if (!isDisposed) {
          setConfigurationError(`无法启动 AI 流式通道：${errorMessage(error)}`);
        }
      });
    return () => {
      isDisposed = true;
      unlisten?.();
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
      }
    };
  }, [flushStreamDeltas]);

  useEffect(() => {
    setGraph(loadCachedGraph(workspaceRootPath));
    setGraphError(null);
  }, [workspaceRootPath]);

  const saveApiKey = useCallback(async (apiKey: string) => {
    const nextConfiguration = await saveDeepSeekApiKey(apiKey);
    setConfiguration(nextConfiguration);
    setConfigurationError(null);
    await testDeepSeekConnection();
  }, []);

  const removeApiKey = useCallback(async () => {
    const nextConfiguration = await deleteDeepSeekApiKey();
    setConfiguration(nextConfiguration);
    setConfigurationError(null);
  }, []);

  const testConnection = useCallback(async () => {
    await testDeepSeekConnection();
    setConfigurationError(null);
  }, []);

  const sendMessage = useCallback(
    async (question: string) => {
      const content = question.trim();
      if (!content || isSending) {
        return;
      }

      const userMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        errorMessage: null,
      };
      const requestId = crypto.randomUUID();
      const assistantMessage: AiMessage = {
        id: requestId,
        role: "assistant",
        content: "",
        errorMessage: null,
      };
      const conversation = [...messages, userMessage].filter(
        (message) => !message.errorMessage && message.content.trim(),
      );
      setMessages((current) => [...current, userMessage, assistantMessage]);
      setIsSending(true);

      try {
        const receipt = await chatWithWorkspace(
          requestId,
          getSource(),
          conversation,
        );
        flushStreamDeltas();
        setMessages((current) =>
          current.map((message) =>
            message.id === requestId
              ? {
                  ...message,
                  content: receipt.content,
                  errorMessage: null,
                }
              : message,
          ),
        );
        setLastReceipt(receipt);
      } catch (error) {
        flushStreamDeltas();
        setMessages((current) =>
          current.map((message) =>
            message.id === requestId
              ? {
                  ...message,
                  errorMessage: errorMessage(error),
                }
              : message,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [flushStreamDeltas, getSource, isSending, messages],
  );

  const clearMessages = useCallback(() => {
    if (!isSending) {
      setMessages([]);
      setLastReceipt(null);
    }
  }, [isSending]);

  const generateGraph = useCallback(async () => {
    const source = getSource();
    if (!source.rootPath || isBuildingGraph) {
      return;
    }
    setIsBuildingGraph(true);
    setGraphError(null);
    try {
      const nextGraph = await buildKnowledgeGraph({
        ...source,
        rootPath: source.rootPath,
      });
      setGraph(nextGraph);
      cacheGraph(source.rootPath, nextGraph);
    } catch (error) {
      setGraphError(errorMessage(error));
    } finally {
      setIsBuildingGraph(false);
    }
  }, [getSource, isBuildingGraph]);

  return {
    clearMessages,
    configuration,
    configurationError,
    generateGraph,
    graph,
    graphError,
    isBuildingGraph,
    isSending,
    lastReceipt,
    messages,
    removeApiKey,
    saveApiKey,
    sendMessage,
    testConnection,
  };
}
