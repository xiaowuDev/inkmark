import { describe, expect, it } from "vitest";

import type { KnowledgeGraph } from "./types";
import { layoutKnowledgeGraph } from "./graph-layout";

const graph: KnowledgeGraph = {
  overview: "demo",
  nodes: [
    {
      id: "concept",
      label: "Concept",
      kind: "concept",
      path: null,
      summary: "",
    },
    {
      id: "document",
      label: "Document",
      kind: "document",
      path: "doc.md",
      summary: "",
    },
  ],
  edges: [
    {
      source: "document",
      target: "concept",
      label: "describes",
      weight: 0.8,
    },
  ],
  context: {
    workspaceName: "demo",
    discoveredFileCount: 1,
    includedFileCount: 1,
    truncatedFileCount: 0,
    omittedFileCount: 0,
    contextBytes: 10,
  },
  generatedAtMs: 0,
  model: "deepseek-v4-flash",
};

describe("knowledge graph layout", () => {
  it("places concept and document nodes on distinct rings", () => {
    const nodes = layoutKnowledgeGraph(graph, 320, 360);
    const concept = nodes.find((node) => node.id === "concept");
    const document = nodes.find((node) => node.id === "document");

    expect(nodes).toHaveLength(2);
    expect(concept).toMatchObject({ x: 160, y: 180 });
    expect(document?.y).not.toBe(concept?.y);
  });
});
