import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type { DirectoryEntry, SaveReceipt } from "../domain";

const MARKDOWN_FILTER = {
  name: "Markdown 文稿",
  extensions: ["md", "markdown", "mdown", "mkd", "txt"],
};

interface PickedWorkspace {
  rootPath: string;
  rootName: string;
}

/** Android 的沙箱没有文件夹选择器，改由 SAF 授权一棵目录树。 */
function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export async function chooseWorkspaceDirectory(): Promise<{
  rootPath: string;
  rootName: string | null;
} | null> {
  if (isAndroid()) {
    const picked = await invoke<PickedWorkspace | null>(
      "pick_android_workspace",
    );
    return picked
      ? { rootPath: picked.rootPath, rootName: picked.rootName }
      : null;
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择 Markdown 工作区",
  });

  return typeof selected === "string"
    ? { rootPath: selected, rootName: null }
    : null;
}

export async function chooseDocument(): Promise<string | null> {
  const selected = await open({
    directory: false,
    filters: [MARKDOWN_FILTER],
    multiple: false,
    title: "打开 Markdown 文稿",
  });

  return typeof selected === "string" ? selected : null;
}

export async function chooseSavePath(
  defaultPath?: string,
): Promise<string | null> {
  const selected = await save({
    ...(defaultPath ? { defaultPath } : {}),
    filters: [MARKDOWN_FILTER],
    title: "保存 Markdown 文稿",
  });

  return selected;
}

export function listDirectory(path: string): Promise<DirectoryEntry[]> {
  return invoke<DirectoryEntry[]>("list_directory", { path });
}

export function createDocument(
  directoryPath: string,
  name: string,
): Promise<DirectoryEntry> {
  return invoke<DirectoryEntry>("create_document", { directoryPath, name });
}

export function readDocument(path: string): Promise<string> {
  return invoke<string>("read_document", { path });
}

export function writeDocument(
  path: string,
  contents: string,
): Promise<SaveReceipt> {
  return invoke<SaveReceipt>("write_document", { path, contents });
}
