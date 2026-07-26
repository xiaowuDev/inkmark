import { useCallback, useEffect, useRef, useState } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import "vditor/dist/js/icons/ant.js";

import { vditorAssetBaseUrl } from "../lib/vditor-assets";
import { EditorSearch, type EditorSearchRequest } from "./EditorSearch";
import type { SelectionAction } from "../ai/selection-actions";
import { SelectionActions } from "./SelectionActions";

interface MarkdownEditorProps {
  documentId: string;
  initialValue: string;
  onChange: (value: string) => void;
  onReady: () => void;
  onSelectionAction: (action: SelectionAction, selection: string) => void;
  /** 注册“把 AI 结果写回文档”的入口，供 AI 面板调用。 */
  registerWriteBack: (writeBack: EditorWriteBack | null) => void;
}

export interface EditorWriteBack {
  replaceSelection: (text: string) => void;
  insertAtCursor: (text: string) => void;
}

const SEARCH_TOOLBAR_ICON = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  ' stroke-width="1.7" stroke-linecap="round">',
  '<circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>',
].join("");

const TOOLBAR = [
  "undo",
  "redo",
  "|",
  "headings",
  "bold",
  "italic",
  "strike",
  "link",
  "|",
  "list",
  "ordered-list",
  "check",
  "quote",
  "code",
  "inline-code",
  "table",
  "|",
  "outline",
  "edit-mode",
  "fullscreen",
];

function markBundledIconSpriteReady(): void {
  if (document.getElementById("vditorIconScript")) {
    return;
  }

  const marker = document.createElement("script");
  marker.id = "vditorIconScript";
  marker.dataset.source = "inkmark-bundle";
  document.head.append(marker);
}

export function MarkdownEditor({
  documentId,
  initialValue,
  onChange,
  onReady,
  onSelectionAction,
  registerWriteBack,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Vditor | null>(null);
  const activeDocumentIdRef = useRef(documentId);
  const isApplyingValueRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  const initialValueRef = useRef(initialValue);
  const [searchRequest, setSearchRequest] =
    useState<EditorSearchRequest | null>(null);

  const openSearch = useCallback((withReplace: boolean) => {
    const selectionText = window.getSelection()?.toString().trim() ?? "";
    const prefill =
      selectionText &&
      selectionText.length <= 120 &&
      !selectionText.includes("\n")
        ? selectionText
        : null;
    setSearchRequest((current) => ({
      id: (current?.id ?? 0) + 1,
      withReplace,
      prefill,
    }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && !event.ctrlKey && event.code === "KeyF") {
        event.preventDefault();
        openSearch(event.altKey);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openSearch]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    markBundledIconSpriteReady();
    let isDisposed = false;
    const searchToolbarItem: IMenuItem = {
      name: "inkmark-search",
      tip: "查找替换 (⌘F)",
      tipPosition: "s",
      icon: SEARCH_TOOLBAR_ICON,
      click: () => {
        openSearch(false);
      },
    };
    const toolbar = TOOLBAR.flatMap((item): (string | IMenuItem)[] =>
      item === "outline" ? [searchToolbarItem, item] : [item],
    );
    const editor = new Vditor(container, {
      after: () => {
        if (isDisposed) {
          return;
        }
        editorRef.current = editor;
        onReadyRef.current();
      },
      cache: { enable: false },
      cdn: vditorAssetBaseUrl(),
      height: "100%",
      hint: { emoji: {} },
      input: (value) => {
        if (!isApplyingValueRef.current) {
          onChangeRef.current(value);
        }
      },
      lang: "zh_CN",
      mode: "ir",
      outline: {
        enable: false,
        position: "right",
      },
      placeholder: "开始写作…",
      preview: {
        delay: 160,
        hljs: {
          enable: true,
          lineNumber: false,
          style: "github",
        },
        markdown: {
          codeBlockPreview: true,
          footnotes: true,
          gfmAutoLink: true,
          mark: true,
          mathBlockPreview: true,
          sanitize: true,
          toc: true,
        },
        math: {
          engine: "KaTeX",
          inlineDigit: true,
        },
        maxWidth: 860,
      },
      resize: { enable: false },
      tab: "    ",
      theme: "classic",
      toolbar,
      toolbarConfig: {
        hide: false,
        pin: true,
      },
      typewriterMode: false,
      undoDelay: 220,
      value: initialValueRef.current,
    });

    return () => {
      isDisposed = true;
      if (editorRef.current === editor) {
        editorRef.current = null;
        editor.destroy();
      }
    };
  }, [openSearch]);

  useEffect(() => {
    registerWriteBack({
      insertAtCursor: (text) => {
        editorRef.current?.focus();
        editorRef.current?.insertValue(text, true);
      },
      replaceSelection: (text) => {
        const editor = editorRef.current;
        if (!editor) {
          return;
        }
        editor.focus();
        // 有选区就覆盖，没有则退化成插入，绝不静默丢弃 AI 的结果。
        if (editor.getSelection()) {
          editor.updateValue(text);
        } else {
          editor.insertValue(text, true);
        }
      },
    });
    return () => {
      registerWriteBack(null);
    };
  }, [registerWriteBack]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || activeDocumentIdRef.current === documentId) {
      return;
    }

    activeDocumentIdRef.current = documentId;
    isApplyingValueRef.current = true;
    editor.setValue(initialValue, true);
    isApplyingValueRef.current = false;
    editor.focus();
  }, [documentId, initialValue]);

  return (
    <>
      <div className="markdown-editor" ref={containerRef} />
      <SelectionActions
        containerRef={containerRef}
        onAction={onSelectionAction}
      />
      <EditorSearch
        containerRef={containerRef}
        onClose={() => {
          setSearchRequest(null);
        }}
        request={searchRequest}
      />
    </>
  );
}
