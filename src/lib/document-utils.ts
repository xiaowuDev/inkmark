import type { DocumentStats, EditorTab } from "../domain";

const CJK_CHARACTER_PATTERN =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/gu;
const LATIN_WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const PATH_SEPARATOR_PATTERN = /[/\\]/u;

export function fileNameFromPath(path: string): string {
  const segments = path.split(PATH_SEPARATOR_PATTERN);
  const fileName = segments.at(-1);
  return fileName && fileName.length > 0 ? fileName : path;
}

export function directoryNameFromPath(path: string): string {
  return fileNameFromPath(path.replace(/[/\\]+$/u, ""));
}

export function countDocumentStats(markdown: string): DocumentStats {
  const cjkCharacters = markdown.match(CJK_CHARACTER_PATTERN)?.length ?? 0;
  const withoutCjk = markdown.replace(CJK_CHARACTER_PATTERN, " ");
  const latinWords = withoutCjk.match(LATIN_WORD_PATTERN)?.length ?? 0;

  return {
    characters: markdown.length,
    lines: markdown.length === 0 ? 1 : markdown.split("\n").length,
    words: cjkCharacters + latinWords,
  };
}

export function nextUntitledName(tabs: readonly EditorTab[]): string {
  const names = new Set(tabs.map((tab) => tab.name));
  let index = 1;

  while (names.has(index === 1 ? "未命名" : `未命名 ${String(index)}`)) {
    index += 1;
  }

  return index === 1 ? "未命名" : `未命名 ${String(index)}`;
}

export function selectTabAfterClose(
  tabs: readonly EditorTab[],
  activeTabId: string | null,
  closingTabId: string,
): string | null {
  if (activeTabId !== closingTabId) {
    return activeTabId;
  }

  const closingIndex = tabs.findIndex((tab) => tab.id === closingTabId);
  if (closingIndex < 0 || tabs.length === 1) {
    return null;
  }

  const neighborIndex =
    closingIndex < tabs.length - 1 ? closingIndex + 1 : closingIndex - 1;
  return tabs[neighborIndex]?.id ?? null;
}
