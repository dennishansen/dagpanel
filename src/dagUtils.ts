import type { Node } from "./types";

export function topologicalSort(nodes: Node[]): Node[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const result: Node[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return;
    for (const dep of node.dependencies) {
      visit(dep);
    }
    result.push(node);
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
}

export function buildChildrenMap(nodes: Node[]): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    for (const depId of node.dependencies) {
      const children = childrenMap.get(depId) || [];
      children.push(node.id);
      childrenMap.set(depId, children);
    }
  }
  return childrenMap;
}

