import type { Node, DagPosition } from "./types";
import { DAG_CONFIG } from "./constants";

export function computeDagLayers(nodes: Node[]): Map<string, number> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const layers = new Map<string, number>();

  function getLayer(id: string): number {
    if (layers.has(id)) return layers.get(id)!;

    const node = nodeMap.get(id);
    if (!node) return 0;

    if (node.dependencies.length === 0) {
      layers.set(id, 0);
      return 0;
    }

    const maxDepLayer = Math.max(...node.dependencies.map(getLayer));
    const layer = maxDepLayer + 1;
    layers.set(id, layer);
    return layer;
  }

  for (const node of nodes) {
    getLayer(node.id);
  }

  return layers;
}

function optimizeLayerOrder(
  nodes: Node[],
  layers: Map<string, number>,
  childrenMap: Map<string, string[]>
): Map<number, Node[]> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const layerGroups = new Map<number, Node[]>();
  for (const node of nodes) {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(node);
  }

  const maxLayer = Math.max(...layers.values());

  const nodePositions = new Map<string, number>();
  for (const [, nodesInLayer] of layerGroups) {
    nodesInLayer.forEach((node, idx) => {
      nodePositions.set(node.id, idx);
    });
  }

  function getBarycenter(nodeId: string, useParents: boolean): number {
    const node = nodeMap.get(nodeId);
    if (!node) return 0;

    let connectedIds: string[];
    if (useParents) {
      connectedIds = node.dependencies;
    } else {
      connectedIds = childrenMap.get(nodeId) || [];
    }

    if (connectedIds.length === 0) {
      return nodePositions.get(nodeId) || 0;
    }

    const sum = connectedIds.reduce((acc, id) => acc + (nodePositions.get(id) || 0), 0);
    return sum / connectedIds.length;
  }

  const iterations = 4;
  for (let iter = 0; iter < iterations; iter++) {
    for (let layer = 1; layer <= maxLayer; layer++) {
      const nodesInLayer = layerGroups.get(layer) || [];

      const barycenters = nodesInLayer.map((node) => ({
        node,
        barycenter: getBarycenter(node.id, true),
      }));

      barycenters.sort((a, b) => a.barycenter - b.barycenter);

      const reordered = barycenters.map((b) => b.node);
      layerGroups.set(layer, reordered);
      reordered.forEach((node, idx) => {
        nodePositions.set(node.id, idx);
      });
    }

    for (let layer = maxLayer - 1; layer >= 0; layer--) {
      const nodesInLayer = layerGroups.get(layer) || [];

      const barycenters = nodesInLayer.map((node) => ({
        node,
        barycenter: getBarycenter(node.id, false),
      }));

      barycenters.sort((a, b) => a.barycenter - b.barycenter);

      const reordered = barycenters.map((b) => b.node);
      layerGroups.set(layer, reordered);
      reordered.forEach((node, idx) => {
        nodePositions.set(node.id, idx);
      });
    }
  }

  return layerGroups;
}

export function computeDagPositions(
  nodes: Node[],
  layers: Map<string, number>,
  childrenMap: Map<string, string[]>
): { positions: Map<string, DagPosition>; width: number; height: number } {
  const positions = new Map<string, DagPosition>();

  const layerGroups = optimizeLayerOrder(nodes, layers, childrenMap);

  const maxLayer = Math.max(...layers.values());
  const maxNodesInLayer = Math.max(...[...layerGroups.values()].map((g) => g.length));

  const totalWidth =
    maxNodesInLayer * DAG_CONFIG.cellWidth + (maxNodesInLayer - 1) * DAG_CONFIG.horizontalGap;
  const totalHeight = (maxLayer + 1) * DAG_CONFIG.cellHeight + maxLayer * DAG_CONFIG.verticalGap;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const nodesInLayer = layerGroups.get(layer) || [];
    const layerWidth =
      nodesInLayer.length * DAG_CONFIG.cellWidth +
      (nodesInLayer.length - 1) * DAG_CONFIG.horizontalGap;
    const startX = (totalWidth - layerWidth) / 2;

    nodesInLayer.forEach((node, col) => {
      positions.set(node.id, {
        row: layer,
        col,
        x: startX + col * (DAG_CONFIG.cellWidth + DAG_CONFIG.horizontalGap),
        y: layer * (DAG_CONFIG.cellHeight + DAG_CONFIG.verticalGap),
      });
    });
  }

  return { positions, width: totalWidth, height: totalHeight };
}
