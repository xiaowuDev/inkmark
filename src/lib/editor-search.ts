const FIND_HIGHLIGHT = "inkmark-find";
const CURRENT_HIGHLIGHT = "inkmark-find-current";

export const MAX_SEARCH_MATCHES = 2000;

export interface DomMatch {
  /** Offset of the match inside the concatenated visible text. */
  start: number;
  range: Range;
}

export function findMatchOffsets(
  text: string,
  query: string,
  caseSensitive: boolean,
  maxMatches = MAX_SEARCH_MATCHES,
): number[] {
  if (!query) {
    return [];
  }
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const offsets: number[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1 && offsets.length < maxMatches) {
    offsets.push(index);
    index = haystack.indexOf(needle, index + needle.length);
  }
  return offsets;
}

function collectTextNodes(root: Node): {
  nodes: Text[];
  starts: number[];
  text: string;
} {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(".vditor-ir__preview")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    starts.push(text.length);
    nodes.push(node);
    text += node.data;
  }
  return { nodes, starts, text };
}

export function collectMatchRanges(
  root: Node,
  query: string,
  caseSensitive: boolean,
): DomMatch[] {
  const { nodes, starts, text } = collectTextNodes(root);
  const offsets = findMatchOffsets(text, query, caseSensitive);
  const matches: DomMatch[] = [];
  let nodeIndex = 0;

  for (const start of offsets) {
    const end = start + query.length;
    let startNode = nodes[nodeIndex];
    let startOffset = starts[nodeIndex];
    while (
      startNode !== undefined &&
      startOffset !== undefined &&
      startOffset + startNode.data.length <= start
    ) {
      nodeIndex += 1;
      startNode = nodes[nodeIndex];
      startOffset = starts[nodeIndex];
    }
    if (startNode === undefined || startOffset === undefined) {
      break;
    }
    let endIndex = nodeIndex;
    let endNode = nodes[endIndex];
    let endOffset = starts[endIndex];
    while (
      endNode !== undefined &&
      endOffset !== undefined &&
      endOffset + endNode.data.length < end
    ) {
      endIndex += 1;
      endNode = nodes[endIndex];
      endOffset = starts[endIndex];
    }
    if (endNode === undefined || endOffset === undefined) {
      break;
    }
    const range = document.createRange();
    range.setStart(startNode, start - startOffset);
    range.setEnd(endNode, end - endOffset);
    matches.push({ start, range });
  }

  return matches;
}

function highlightRegistry(): HighlightRegistry | null {
  return typeof Highlight === "undefined" ? null : CSS.highlights;
}

export function applySearchHighlights(
  matches: readonly DomMatch[],
  currentIndex: number,
): void {
  const registry = highlightRegistry();
  if (!registry) {
    return;
  }
  registry.set(
    FIND_HIGHLIGHT,
    new Highlight(...matches.map((match) => match.range)),
  );
  const current = matches[currentIndex];
  if (current) {
    registry.set(CURRENT_HIGHLIGHT, new Highlight(current.range));
  } else {
    registry.delete(CURRENT_HIGHLIGHT);
  }
}

export function clearSearchHighlights(): void {
  const registry = highlightRegistry();
  registry?.delete(FIND_HIGHLIGHT);
  registry?.delete(CURRENT_HIGHLIGHT);
}

export function scrollMatchIntoView(match: DomMatch): void {
  const container = match.range.startContainer;
  const element =
    container instanceof Element ? container : container.parentElement;
  element?.scrollIntoView({ block: "center" });
}

/**
 * Replaces a matched range by selecting it and dispatching an editing
 * command, so the editor treats it exactly like user input (undo included).
 */
export function replaceDomRange(
  match: DomMatch,
  replacement: string,
  editable: HTMLElement,
): boolean {
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }
  editable.focus({ preventScroll: true });
  selection.removeAllRanges();
  selection.addRange(match.range);
  // execCommand 虽已废弃，但仍是唯一能让 contenteditable 编辑进入
  // Vditor 输入与撤销管线的方式（Input Events Level 2 无替代 API）。
  return replacement
    ? // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertText", false, replacement)
    : // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("delete");
}
