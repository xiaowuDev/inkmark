import { useState } from "react";

import type { AiConfiguration } from "../ai/types";
import { Icon } from "./Icon";

interface AiSettingsProps {
  configuration: AiConfiguration | null;
  configurationError: string | null;
  onDelete: () => Promise<void>;
  onSave: (apiKey: string) => Promise<void>;
  onTest: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AiSettings({
  configuration,
  configurationError,
  onDelete,
  onSave,
  onTest,
}: AiSettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isConfigured = configuration?.isConfigured ?? false;
  const shouldShowInput = !isConfigured || isEditing;

  async function saveAndTest() {
    if (!apiKey.trim() || isWorking) {
      return;
    }
    setIsWorking(true);
    setFeedback("正在保存到 macOS 钥匙串并测试连接…");
    try {
      await onSave(apiKey);
      setApiKey("");
      setIsEditing(false);
      setFeedback("连接成功，DeepSeek 已可使用。");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function testConnection() {
    setIsWorking(true);
    setFeedback("正在测试 DeepSeek 连接…");
    try {
      await onTest();
      setFeedback("连接正常。");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteKey() {
    setIsWorking(true);
    setFeedback(null);
    try {
      await onDelete();
      setApiKey("");
      setIsEditing(false);
      setFeedback("API Key 已从 macOS 钥匙串删除。");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="ai-settings">
      <div className="ai-settings-hero">
        <span className="ai-settings-key">
          <Icon name="key" />
        </span>
        <div>
          <h3>连接 DeepSeek</h3>
          <p>密钥只保存在本机 macOS 钥匙串，不会写入文稿或 GitHub。</p>
        </div>
      </div>

      {isConfigured ? (
        <div className="ai-connection-card">
          <span className="connection-dot" />
          <div>
            <strong>已安全连接</strong>
            <span>{configuration?.model}</span>
          </div>
          <Icon name="check" />
        </div>
      ) : null}

      {shouldShowInput ? (
        <label className="ai-key-field">
          <span>DeepSeek API Key</span>
          <input
            autoComplete="off"
            onChange={(event) => {
              setApiKey(event.target.value);
            }}
            placeholder="sk-…"
            spellCheck={false}
            type="password"
            value={apiKey}
          />
        </label>
      ) : null}

      <div className="ai-settings-actions">
        {shouldShowInput ? (
          <button
            className="ai-primary-action"
            disabled={!apiKey.trim() || isWorking}
            onClick={() => {
              void saveAndTest();
            }}
            type="button"
          >
            {isWorking ? <span className="ink-loader" /> : <Icon name="key" />}
            保存并测试
          </button>
        ) : (
          <>
            <button
              className="ai-primary-action"
              disabled={isWorking}
              onClick={() => {
                void testConnection();
              }}
              type="button"
            >
              {isWorking ? (
                <span className="ink-loader" />
              ) : (
                <Icon name="refresh" />
              )}
              测试连接
            </button>
            <button
              className="ai-secondary-action"
              disabled={isWorking}
              onClick={() => {
                setIsEditing(true);
                setFeedback(null);
              }}
              type="button"
            >
              更换密钥
            </button>
          </>
        )}
      </div>

      {isConfigured && !isEditing ? (
        <button
          className="ai-danger-link"
          disabled={isWorking}
          onClick={() => {
            void deleteKey();
          }}
          type="button"
        >
          从钥匙串移除密钥
        </button>
      ) : null}

      {feedback || configurationError ? (
        <p
          className={`ai-settings-feedback ${
            (feedback ?? configurationError)?.includes("成功") ||
            (feedback ?? configurationError)?.includes("正常")
              ? "is-success"
              : ""
          }`}
          role="status"
        >
          {feedback ?? configurationError}
        </p>
      ) : null}

      <div className="ai-privacy-note">
        <strong>数据边界</strong>
        <p>
          提问和构建网络时，InkMark 会把当前文稿及工作区内可读文本发送给
          DeepSeek。二进制文件、隐藏目录和构建产物不会上传。
        </p>
      </div>
    </div>
  );
}
