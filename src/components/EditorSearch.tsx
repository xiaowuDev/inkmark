import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

import {
  applySearchHighlights,
  clearSearchHighlights,
  collectMatchRanges,
  MAX_SEARCH_MATCHES,
  replaceDomRange,
  scrollMatchIntoView,
  type DomMatch,
} from "../lib/editor-search";
import { Icon } from "./Icon";

const REFRESH_DEBOUNCE_MS = 250;

export interface EditorSearchRequest {
  id: number;
  withReplace: boolean;
  prefill: string | null;
}

interface EditorSearchProps {
  containerRef: RefObject<HTMLDivElement | null>;
  request: EditorSearchRequest | null;
  onClose: () => void;
}

function visibleEditable(container: HTMLElement | null): HTMLElement | null {
  if (!container) {
    return null;
  }
  const candidates = container.querySelectorAll<HTMLElement>(
    ".vditor-ir .vditor-reset, .vditor-wysiwyg .vditor-reset, .vditor-sv",
  );
  for (const candidate of candidates) {
    if (candidate.offsetParent !== null) {
      return candidate;
    }
  }
  return null;
}

// 让重新打开的搜索条记住上一次的关键词与替换行展开状态。
let stickyQuery = "";
let stickyShowReplace = false;

export function EditorSearch({
  containerRef,
  request,
  onClose,
}: EditorSearchProps) {
  if (!request) {
    return null;
  }

  return (
    <EditorSearchPanel
      containerRef={containerRef}
      initialQuery={request.prefill ?? stickyQuery}
      initialShowReplace={request.withReplace || stickyShowReplace}
      key={request.id}
      onClose={onClose}
      onPersist={(query, showReplace) => {
        stickyQuery = query;
        stickyShowReplace = showReplace;
      }}
    />
  );
}

interface EditorSearchPanelProps {
  containerRef: RefObject<HTMLDivElement | null>;
  initialQuery: string;
  initialShowReplace: boolean;
  onClose: () => void;
  onPersist: (query: string, showReplace: boolean) => void;
}

function EditorSearchPanel({
  containerRef,
  initialQuery,
  initialShowReplace,
  onClose,
  onPersist,
}: EditorSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplace, setShowReplace] = useState(initialShowReplace);
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const matchesRef = useRef<readonly DomMatch[]>([]);
  const findInputRef = useRef<HTMLInputElement>(null);

  const recompute = useCallback(
    (preferredIndex: number, shouldScroll: boolean) => {
      const root = visibleEditable(containerRef.current);
      const matches =
        root && query ? collectMatchRanges(root, query, caseSensitive) : [];
      const index =
        matches.length === 0
          ? 0
          : Math.min(Math.max(preferredIndex, 0), matches.length - 1);
      matchesRef.current = matches;
      setMatchCount(matches.length);
      setCurrentIndex(index);
      applySearchHighlights(matches, index);
      const current = matches[index];
      if (shouldScroll && current) {
        scrollMatchIntoView(current);
      }
    },
    [caseSensitive, containerRef, query],
  );

  useEffect(() => {
    recompute(0, false);
  }, [recompute]);

  useEffect(() => clearSearchHighlights, []);

  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let timer: number | null = null;
    const observer = new MutationObserver(() => {
      timer ??= window.setTimeout(() => {
        timer = null;
        recompute(currentIndex, false);
      }, REFRESH_DEBOUNCE_MS);
    });
    observer.observe(container, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [containerRef, currentIndex, recompute]);

  const goToMatch = useCallback(
    (delta: number) => {
      const matches = matchesRef.current;
      if (matches.length === 0) {
        return;
      }
      const index = (currentIndex + delta + matches.length) % matches.length;
      const match = matches[index];
      if (!match) {
        return;
      }
      setCurrentIndex(index);
      applySearchHighlights(matches, index);
      scrollMatchIntoView(match);
    },
    [currentIndex],
  );

  const closeSearch = useCallback(() => {
    visibleEditable(containerRef.current)?.focus({ preventScroll: true });
    onClose();
  }, [containerRef, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
      } else if (event.metaKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        goToMatch(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeSearch, goToMatch]);

  const replaceCurrent = useCallback(() => {
    const root = visibleEditable(containerRef.current);
    const match = matchesRef.current[currentIndex];
    if (!root || !match) {
      return;
    }
    replaceDomRange(match, replacement, root);
    recompute(currentIndex, true);
    findInputRef.current?.focus();
  }, [containerRef, currentIndex, recompute, replacement]);

  const replaceAll = useCallback(() => {
    const root = visibleEditable(containerRef.current);
    if (!root || !query) {
      return;
    }
    let previousStart = Number.POSITIVE_INFINITY;
    for (let step = 0; step < MAX_SEARCH_MATCHES; step += 1) {
      const matches = collectMatchRanges(root, query, caseSensitive);
      let target: DomMatch | undefined;
      for (let index = matches.length - 1; index >= 0; index -= 1) {
        const candidate = matches[index];
        if (candidate && candidate.start < previousStart) {
          target = candidate;
          break;
        }
      }
      if (!target) {
        break;
      }
      replaceDomRange(target, replacement, root);
      previousStart = target.start;
    }
    recompute(0, false);
    findInputRef.current?.focus();
  }, [caseSensitive, containerRef, query, recompute, replacement]);

  function handleFindKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      goToMatch(event.shiftKey ? -1 : 1);
    }
  }

  function handleReplaceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      replaceCurrent();
    }
  }

  const hasMatches = matchCount > 0;

  return (
    <div className="editor-search" role="search">
      <div className="editor-search-row">
        <input
          aria-label="在文稿中查找"
          onChange={(event) => {
            setQuery(event.target.value);
            onPersist(event.target.value, showReplace);
          }}
          onKeyDown={handleFindKeyDown}
          placeholder="查找…"
          ref={findInputRef}
          spellCheck={false}
          type="text"
          value={query}
        />
        <span
          className={`editor-search-count ${
            query && !hasMatches ? "is-empty" : ""
          }`}
        >
          {query
            ? hasMatches
              ? `${String(currentIndex + 1)}/${String(matchCount)}`
              : "无结果"
            : ""}
        </span>
        <button
          aria-label="区分大小写"
          aria-pressed={caseSensitive}
          className={`editor-search-toggle ${caseSensitive ? "is-active" : ""}`}
          onClick={() => {
            setCaseSensitive((current) => !current);
          }}
          title="区分大小写"
          type="button"
        >
          Aa
        </button>
        <button
          aria-label="上一个匹配"
          disabled={!hasMatches}
          onClick={() => {
            goToMatch(-1);
          }}
          title="上一个 (⇧⌘G)"
          type="button"
        >
          <Icon className="is-up" name="chevron" />
        </button>
        <button
          aria-label="下一个匹配"
          disabled={!hasMatches}
          onClick={() => {
            goToMatch(1);
          }}
          title="下一个 (⌘G)"
          type="button"
        >
          <Icon className="is-down" name="chevron" />
        </button>
        <button
          aria-expanded={showReplace}
          aria-label="切换替换"
          className={`editor-search-toggle ${showReplace ? "is-active" : ""}`}
          onClick={() => {
            const next = !showReplace;
            setShowReplace(next);
            onPersist(query, next);
          }}
          title="替换"
          type="button"
        >
          <Icon name="refresh" />
        </button>
        <button
          aria-label="关闭查找"
          onClick={closeSearch}
          title="关闭 (Esc)"
          type="button"
        >
          <Icon name="close" />
        </button>
      </div>
      {showReplace ? (
        <div className="editor-search-row">
          <input
            aria-label="替换为"
            onChange={(event) => {
              setReplacement(event.target.value);
            }}
            onKeyDown={handleReplaceKeyDown}
            placeholder="替换为…"
            spellCheck={false}
            type="text"
            value={replacement}
          />
          <button
            className="editor-search-action"
            disabled={!hasMatches}
            onClick={replaceCurrent}
            type="button"
          >
            替换
          </button>
          <button
            className="editor-search-action"
            disabled={!hasMatches}
            onClick={replaceAll}
            type="button"
          >
            全部替换
          </button>
        </div>
      ) : null}
    </div>
  );
}
