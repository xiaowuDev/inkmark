import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  formatContextBytes,
  splitWorkspaceReferences,
} from "../ai/message-utils";
import type { AiConfiguration, AiMessage, ChatReceipt } from "../ai/types";
import { Icon } from "./Icon";

const SUGGESTIONS = ["总结当前文稿", "梳理工作区主题", "找出相关文档"];

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
  onSend: (question: string) => Promise<void>;
}

function MessageContent({
  content,
  onOpenReference,
}: {
  content: string;
  onOpenReference: (relativePath: string) => void;
}) {
  return (
    <>
      {splitWorkspaceReferences(content).map((part, index): ReactNode =>
        part.type === "reference" ? (
          <button
            className="ai-file-reference"
            key={`${part.value}-${String(index)}`}
            onClick={() => {
              onOpenReference(part.value);
            }}
            title={`打开 ${part.value}`}
            type="button"
          >
            <Icon name="document" />
            {part.value}
          </button>
        ) : (
          <span key={`${part.value.slice(0, 18)}-${String(index)}`}>
            {part.value}
          </span>
        ),
      )}
    </>
  );
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
  onSend,
}: AiChatProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isConfigured = configuration?.isConfigured ?? false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [isSending, messages]);

  async function submit(question = draft) {
    const content = question.trim();
    if (!content || isSending || !isConfigured) {
      return;
    }
    setDraft("");
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

      <div className="ai-message-list" aria-live="polite">
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
          messages.map((message) => (
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
                  <MessageContent
                    content={message.content}
                    onOpenReference={onOpenReference}
                  />
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
            </article>
          ))
        )}
        <div ref={bottomRef} />
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
            disabled={isSending}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="询问当前文稿或整个工作区…"
            rows={3}
            value={draft}
          />
          <button
            aria-label="发送"
            disabled={!draft.trim() || isSending}
            onClick={() => {
              void submit();
            }}
            title="发送 (Enter)"
            type="button"
          >
            <Icon name="send" />
          </button>
        </div>
        <p>Enter 发送 · Shift + Enter 换行</p>
      </div>
    </div>
  );
}
