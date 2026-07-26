import type {
  KnowledgeGraph,
  KnowledgeNode,
  PositionedKnowledgeNode,
} from "./types";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function nodeDegree(graph: KnowledgeGraph, nodeId: string): number {
  let degree = 0;
  for (const edge of graph.edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      degree += 1;
    }
  }
  return degree;
}

function sortByImportance(
  graph: KnowledgeGraph,
  nodes: readonly KnowledgeNode[],
): KnowledgeNode[] {
  return [...nodes].sort((left, right) => {
    const degreeDifference =
      nodeDegree(graph, right.id) - nodeDegree(graph, left.id);
    return degreeDifference || left.label.localeCompare(right.label, "zh-CN");
  });
}

export function layoutKnowledgeGraph(
  graph: KnowledgeGraph,
  width: number,
  height: number,
): PositionedKnowledgeNode[] {
  if (graph.nodes.length === 0) {
    return [];
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const documents = sortByImportance(
    graph,
    graph.nodes.filter((node) => node.kind === "document"),
  );
  const concepts = sortByImportance(
    graph,
    graph.nodes.filter((node) => node.kind !== "document"),
  );
  const maxDegree = Math.max(
    1,
    ...graph.nodes.map((node) => nodeDegree(graph, node.id)),
  );

  function positionRing(
    nodes: readonly KnowledgeNode[],
    ringRadius: number,
    phase: number,
  ): PositionedKnowledgeNode[] {
    return nodes.map((node, index) => {
      const angle =
        nodes.length <= 2
          ? phase + (index * Math.PI * 2) / Math.max(nodes.length, 1)
          : phase + index * GOLDEN_ANGLE;
      const degree = nodeDegree(graph, node.id);
      const radialJitter =
        nodes.length > 6 ? ((index % 3) - 1) * Math.min(16, ringRadius / 8) : 0;
      return {
        ...node,
        x: centerX + Math.cos(angle) * (ringRadius + radialJitter),
        y: centerY + Math.sin(angle) * (ringRadius + radialJitter),
        radius: 7 + (degree / maxDegree) * 6,
      };
    });
  }

  const innerRadius = Math.min(width, height) * 0.23;
  const outerRadius = Math.min(width, height) * 0.4;
  const soleConcept = concepts.length === 1 ? concepts[0] : undefined;
  const conceptPositions = soleConcept
    ? [
        {
          ...soleConcept,
          x: centerX,
          y: centerY,
          radius: 13,
        },
      ]
    : positionRing(concepts, innerRadius, -Math.PI / 2);
  const documentPositions = positionRing(
    documents,
    outerRadius,
    -Math.PI / 2 + GOLDEN_ANGLE / 2,
  );

  return [...conceptPositions, ...documentPositions];
}
