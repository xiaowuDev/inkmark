import {
  memo,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import type Vditor from "vditor";

import { splitWorkspaceReferences } from "../ai/message-utils";
import { vditorAssetBaseUrl } from "../lib/vditor-assets";
import { Icon } from "./Icon";

const REFERENCE_HREF_PREFIX = "#inkmark-ref=";
const RENDER_DEBOUNCE_MS = 90;

let vditorModulePromise: Promise<{ default: typeof Vditor }> | null = null;

async function renderMarkdown(markdown: string): Promise<string> {
  vditorModulePromise ??= import("vditor");
  const { default: Vditor } = await vditorModulePromise;
  return Vditor.md2html(markdown, {
    cdn: vditorAssetBaseUrl(),
    mode: "light",
    markdown: { sanitize: true },
  });
}

function toRenderableMarkdown(content: string): string {
  return content.replaceAll(
    /\[\[([^\]\r\n]{1,260})\]\]/g,
    (match, reference: string) => {
      const trimmed = reference.trim();
      return trimmed
        ? `[${trimmed}](${REFERENCE_HREF_PREFIX}${encodeURIComponent(trimmed)})`
        : match;
    },
  );
}

interface AiMarkdownProps {
  content: string;
  onOpenReference: (relativePath: string) => void;
}

export function PlainMessageContent({
  content,
  onOpenReference,
}: AiMarkdownProps) {
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

export const AiMarkdown = memo(function AiMarkdown({
  content,
  onOpenReference,
}: AiMarkdownProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    const timer = window.setTimeout(() => {
      renderMarkdown(toRenderableMarkdown(content))
        .then((rendered) => {
          if (!isDisposed) {
            setHtml(rendered);
          }
        })
        .catch(() => {
          if (!isDisposed) {
            setHtml(null);
          }
        });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      isDisposed = true;
      window.clearTimeout(timer);
    };
  }, [content]);

  if (html === null) {
    return (
      <PlainMessageContent
        content={content}
        onOpenReference={onOpenReference}
      />
    );
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) {
      return;
    }
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith(REFERENCE_HREF_PREFIX)) {
      try {
        onOpenReference(
          decodeURIComponent(href.slice(REFERENCE_HREF_PREFIX.length)),
        );
      } catch {
        // A malformed percent-encoding in model output is not actionable.
      }
    }
  };

  return (
    <div
      className="ai-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
});
