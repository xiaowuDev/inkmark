import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { formatContextBytes } from "../ai/message-utils";
import type { AiConfiguration, AiMessage, ChatReceipt } from "../ai/types";
import { AiMarkdown, PlainMessageContent } from "./AiMarkdown";
import { Icon } from "./Icon";

const SUGGESTIONS = ["总结当前文稿", "梳理工作区主题", "找出相关文档"];
const SCROLL_PIN_THRESHOLD_PX = 90;

interface AiChatProps {
  activeDocumentName: string | null;
  configuration: AiConfiguration | null;
  isSending: boolean;
  lastReceipt: ChatReceipt | null;
  messages: readonly AiMessage[];
  workspaceName: string | null;
  onClear: () => void;
  onOpenReference: (relativePath: string) => void;
  onOpenSettings: () => void;
  onRetry: (assistantMessageId: string) => void;
  onSend: (question: string) => Promise<void>;
  onStop: () => void;
}

export function AiChat({
  activeDocumentName,
  configuration,
  isSending,
  lastReceipt,
  messages,
  workspaceName,
  onClear,
  onOpenReference,
  onOpenSettings,
  onRetry,
  onSend,
  onStop,
}: AiChatProps) {
  const [draft, setDraft] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottomRef = useRef(true);
  const isConfigured = configuration?.isConfigured ?? false;

  useEffect(() => {
    const list = listRef.current;
    if (list && isPinnedToBottomRef.current) {
      list.scrollTo({ top: list.scrollHeight, behavior: "instant" });
    }
  }, [isSending, messages]);

  function handleListScroll() {
    const list = listRef.current;
    if (list) {
      isPinnedToBottomRef.current =
        list.scrollHeight - list.scrollTop - list.clientHeight <
        SCROLL_PIN_THRESHOLD_PX;
    }
  }

  async function submit(question = draft) {
    const content = question.trim();
    if (!content || isSending || !isConfigured) {
      return;
    }
    setDraft("");
    isPinnedToBottomRef.current = true;
    await onSend(content);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submit();
    }
  }

  async function copyMessage(message: AiMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId((current) =>
          current === message.id ? null : current,
        );
      }, 1600);
    } catch {
      // Clipboard access can be denied; the button simply stays unchanged.
    }
  }

  if (!isConfigured) {
    return (
      <div className="ai-empty-state">
        <span className="ai-orbit-mark">
          <Icon name="ai" />
        </span>
        <h3>让 DeepSeek 读懂你的工作区</h3>
        <p>
          配置 API Key
          后，可以围绕当前文稿提问，也能跨工作区查找、比较和总结资料。
        </p>
        <button
          className="ai-primary-action"
          onClick={onOpenSettings}
          type="button"
        >
          <Icon name="key" />
          配置 DeepSeek
        </button>
      </div>
    );
  }

  const lastMessageId = messages.at(-1)?.id ?? null;

  return (
    <div className="ai-chat">
      <div className="ai-context-strip">
        <div>
          <span className="context-live-dot" />
          <strong>{workspaceName ?? activeDocumentName ?? "当前文稿"}</strong>
        </div>
        {lastReceipt ? (
          <span title="最近一次请求实际送入 AI 的工作区文本">
            {lastReceipt.context.includedFileCount} 个文件 ·{" "}
            {formatContextBytes(lastReceipt.context.contextBytes)}
          </span>
        ) : (
          <span>
            {workspaceName ? "发送时读取全部工作区文本" : "当前文稿上下文"}
          </span>
        )}
      </div>

      <div
        aria-live="polite"
        className="ai-message-list"
        onScroll={handleListScroll}
        ref={listRef}
      >
        {messages.length === 0 ? (
          <div className="ai-chat-intro">
            <p className="eyebrow">WORKSPACE INTELLIGENCE</p>
            <h3>从你的资料出发，而不是凭空回答。</h3>
            <p>
              DeepSeek 会在每次提问时读取当前未保存内容和工作区文件，并用
              [[文件路径]] 标注依据。
            </p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    void submit(suggestion);
                  }}
                  type="button"
                >
                  {suggestion}
                  <Icon name="send" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isStreaming =
              isSending &&
              message.role === "assistant" &&
              message.id === lastMessageId;
            const canCopy =
              message.role === "assistant" &&
              !isStreaming &&
              message.content.length > 0;
            const canRetry =
              message.role === "assistant" &&
              !isSending &&
              message.errorMessage !== null;
            return (
              <article
                className={`ai-message is-${message.role}`}
                key={message.id}
              >
                <div className="ai-message-author">
                  {message.role === "assistant" ? (
                    <>
                      <span className="assistant-mark">墨</span>
                      DeepSeek
                    </>
                  ) : (
                    "你"
                  )}
                </div>
                <div
                  className={`ai-message-content ${
                    message.errorMessage ? "has-error" : ""
                  }`}
                >
                  {message.content ? (
                    message.role === "assistant" ? (
                      <AiMarkdown
                        content={message.content}
                        onOpenReference={onOpenReference}
                      />
                    ) : (
                      <PlainMessageContent
                        content={message.content}
                        onOpenReference={onOpenReference}
                      />
                    )
                  ) : message.errorMessage ? null : (
                    <span className="ai-thinking">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {message.errorMessage ? (
                    <span>{message.errorMessage}</span>
                  ) : null}
                </div>
                {canCopy || canRetry ? (
                  <div
                    className={`ai-message-actions ${
                      canRetry ? "is-visible" : ""
                    }`}
                  >
                    {canCopy ? (
                      <button
                        onClick={() => {
                          void copyMessage(message);
                        }}
                        type="button"
                      >
                        <Icon
                          name={
                            copiedMessageId === message.id ? "check" : "copy"
                          }
                        />
                        {copiedMessageId === message.id ? "已复制" : "复制"}
                      </button>
                    ) : null}
                    {canRetry ? (
                      <button
                        onClick={() => {
                          isPinnedToBottomRef.current = true;
                          onRetry(message.id);
                        }}
                        type="button"
                      >
                        <Icon name="refresh" />
                        重试
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <div className="ai-composer-wrap">
        {messages.length > 0 ? (
          <button
            className="ai-clear-chat"
            disabled={isSending}
            onClick={onClear}
            type="button"
          >
            清空对话
          </button>
        ) : null}
        <div className="ai-composer">
          <textarea
            aria-label="向 DeepSeek 提问"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="询问当前文稿或整个工作区…"
            rows={3}
            value={draft}
          />
          {isSending ? (
            <button
              aria-label="停止生成"
              className="is-stop"
              onClick={onStop}
              title="停止生成"
              type="button"
            >
              <Icon name="stop" />
            </button>
          ) : (
            <button
              aria-label="发送"
              disabled={!draft.trim()}
              onClick={() => {
                void submit();
              }}
              title="发送 (Enter)"
              type="button"
            >
              <Icon name="send" />
            </button>
          )}
        </div>
        <p>Enter 发送 · Shift + Enter 换行</p>
      </div>
    </div>
  );
}
