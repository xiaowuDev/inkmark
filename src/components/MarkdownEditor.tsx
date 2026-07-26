import { useEffect, useRef } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import "vditor/dist/js/icons/ant.js";

import { vditorAssetBaseUrl } from "../lib/vditor-assets";

interface MarkdownEditorProps {
  documentId: string;
  initialValue: string;
  onChange: (value: string) => void;
  onReady: () => void;
}

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
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Vditor | null>(null);
  const activeDocumentIdRef = useRef(documentId);
  const isApplyingValueRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  const initialValueRef = useRef(initialValue);

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
      toolbar: TOOLBAR,
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
  }, []);

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

  return <div className="markdown-editor" ref={containerRef} />;
}
