import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { listWorkspaceEntries } from "../ai/client";
import type { WorkspaceEntry } from "../ai/types";
import { Icon } from "./Icon";

const MAX_SUGGESTIONS = 8;
const MENTION_TRIGGER = /@([^@\s]*)$/u;
const EMPTY_ENTRIES: readonly WorkspaceEntry[] = [];

interface AiComposerProps {
  isSending: boolean;
  mentions: readonly WorkspaceEntry[];
  workspaceRootPath: string | null;
  onMentionsChange: (mentions: readonly WorkspaceEntry[]) => void;
  onSend: (question: string) => void;
  onStop: () => void;
}

/** 子串匹配 + 简单排序：名称命中优先，其次路径靠前的。 */
function rankEntries(
  entries: readonly WorkspaceEntry[],
  query: string,
): WorkspaceEntry[] {
  if (!query) {
    return entries.slice(0, MAX_SUGGESTIONS);
  }
  const needle = query.toLowerCase();
  const scored: { entry: WorkspaceEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    const path = entry.path.toLowerCase();
    const nameIndex = name.indexOf(needle);
    const pathIndex = path.indexOf(needle);
    if (nameIndex === -1 && pathIndex === -1) {
      continue;
    }
    const score =
      (nameIndex === 0 ? 0 : nameIndex === -1 ? 400 : 100 + nameIndex) +
      (entry.isDirectory ? 0 : 20) +
      path.length / 200;
    scored.push({ entry, score });
    if (scored.length > 400) {
      break;
    }
  }
  return scored
    .sort((left, right) => left.score - right.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((item) => item.entry);
}

export function AiComposer({
  isSending,
  mentions,
  workspaceRootPath,
  onMentionsChange,
  onSend,
  onStop,
}: AiComposerProps) {
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState<{
    rootPath: string | null;
    entries: readonly WorkspaceEntry[];
  }>({ rootPath: null, entries: [] });
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 索引与它所属的工作区绑定，切换工作区时旧索引立即失效。
  const entries =
    loaded.rootPath === workspaceRootPath ? loaded.entries : EMPTY_ENTRIES;

  useEffect(() => {
    if (!workspaceRootPath) {
      return;
    }
    let isDisposed = false;
    void listWorkspaceEntries(workspaceRootPath)
      .then((workspaceEntries) => {
        if (!isDisposed) {
          setLoaded({ rootPath: workspaceRootPath, entries: workspaceEntries });
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setLoaded({ rootPath: workspaceRootPath, entries: [] });
        }
      });
    return () => {
      isDisposed = true;
    };
  }, [workspaceRootPath]);

  const suggestions = useMemo(
    () =>
      mentionQuery === null
        ? []
        : rankEntries(entries, mentionQuery).filter(
            (entry) => !mentions.some((mention) => mention.path === entry.path),
          ),
    [entries, mentionQuery, mentions],
  );

  const closePicker = useCallback(() => {
    setMentionQuery(null);
    setHighlightIndex(0);
  }, []);

  const addMention = useCallback(
    (entry: WorkspaceEntry) => {
      onMentionsChange([...mentions, entry]);
      setDraft((current) => current.replace(MENTION_TRIGGER, ""));
      closePicker();
      textareaRef.current?.focus();
    },
    [closePicker, mentions, onMentionsChange],
  );

  const removeMention = useCallback(
    (path: string) => {
      onMentionsChange(mentions.filter((mention) => mention.path !== path));
    },
    [mentions, onMentionsChange],
  );

  function updateDraft(value: string) {
    setDraft(value);
    const trigger = MENTION_TRIGGER.exec(value);
    if (trigger && workspaceRootPath) {
      setMentionQuery(trigger[1] ?? "");
      setHighlightIndex(0);
    } else {
      closePicker();
    }
  }

  function submit() {
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }
    setDraft("");
    closePicker();
    onSend(content);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (suggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((current) => {
          const next = current + (event.key === "ArrowDown" ? 1 : -1);
          return (next + suggestions.length) % suggestions.length;
        });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const entry = suggestions[highlightIndex];
        if (entry) {
          event.preventDefault();
          addMention(entry);
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }

    // 光标贴着最后一个胶囊时，退格直接删除它。
    const lastMention = mentions.at(-1);
    if (event.key === "Backspace" && !draft && lastMention) {
      event.preventDefault();
      removeMention(lastMention.path);
    }
  }

  return (
    <div className="ai-composer-wrap">
      {suggestions.length > 0 ? (
        <div className="ai-mention-picker" role="listbox">
          {suggestions.map((entry, index) => (
            <button
              aria-selected={index === highlightIndex}
              className={index === highlightIndex ? "is-highlighted" : ""}
              key={entry.path}
              onMouseDown={(event) => {
                event.preventDefault();
                addMention(entry);
              }}
              onMouseEnter={() => {
                setHighlightIndex(index);
              }}
              role="option"
              type="button"
            >
              <Icon name={entry.isDirectory ? "folder" : "document"} />
              <span className="ai-mention-name">{entry.name}</span>
              <span className="ai-mention-path">{entry.path}</span>
            </button>
          ))}
        </div>
      ) : null}

      {mentions.length > 0 ? (
        <div className="ai-mention-chips">
          {mentions.map((mention) => (
            <span className="ai-mention-chip" key={mention.path}>
              <Icon name={mention.isDirectory ? "folder" : "document"} />
              <span title={mention.path}>{mention.name}</span>
              <button
                aria-label={`移除 ${mention.name}`}
                onClick={() => {
                  removeMention(mention.path);
                }}
                type="button"
              >
                <Icon name="close" />
              </button>
            </span>
          ))}
          <button
            className="ai-mention-clear"
            onClick={() => {
              onMentionsChange([]);
            }}
            type="button"
          >
            全部移除
          </button>
        </div>
      ) : null}

      <div className="ai-composer">
        <textarea
          aria-label="向 DeepSeek 提问"
          onChange={(event) => {
            updateDraft(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            workspaceRootPath
              ? "询问当前文稿，输入 @ 圈定文件或文件夹…"
              : "询问当前文稿…"
          }
          ref={textareaRef}
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
            onClick={submit}
            title="发送 (Enter)"
            type="button"
          >
            <Icon name="send" />
          </button>
        )}
      </div>
      <p>
        {mentions.length > 0
          ? `已限定 ${String(mentions.length)} 个范围 · Enter 发送`
          : "Enter 发送 · Shift + Enter 换行 · @ 选择文件"}
      </p>
    </div>
  );
}
