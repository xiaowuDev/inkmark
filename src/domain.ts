export type EntryKind = "directory" | "document";

export interface DirectoryEntry {
  name: string;
  path: string;
  kind: EntryKind;
  modifiedAtMs: number | null;
  sizeBytes: number | null;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface EditorTab {
  id: string;
  name: string;
  path: string | null;
  isDirty: boolean;
  isLoading: boolean;
  saveState: SaveState;
  errorMessage: string | null;
}

export interface Workspace {
  rootPath: string;
  rootName: string;
}

export interface DocumentStats {
  characters: number;
  lines: number;
  words: number;
}

export interface SaveReceipt {
  bytesWritten: number;
  modifiedAtMs: number;
  path: string;
}
