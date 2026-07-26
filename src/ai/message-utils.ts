const WORKSPACE_REFERENCE_PATTERN = /\[\[([^\]\r\n]{1,260})\]\]/g;

export interface MessageTextPart {
  type: "text";
  value: string;
}

export interface MessageReferencePart {
  type: "reference";
  value: string;
}

export type MessagePart = MessageTextPart | MessageReferencePart;

export function splitWorkspaceReferences(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let cursor = 0;

  for (const match of content.matchAll(WORKSPACE_REFERENCE_PATTERN)) {
    const index = match.index;
    const reference = match[1]?.trim();
    if (!reference) {
      continue;
    }
    if (index > cursor) {
      parts.push({ type: "text", value: content.slice(cursor, index) });
    }
    parts.push({ type: "reference", value: reference });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) {
    parts.push({ type: "text", value: content.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: content }];
}

export function formatContextBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${String(Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
