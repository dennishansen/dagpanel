import type { Node, LineSegment, LayoutConfig, ComputedLayout } from "./types";
import { LIST_CONFIG } from "./constants";
import { buildChildrenMap } from "./dagUtils";

export function computeListPositions(
  sorted: Node[],
  leftMargin: number
): { positions: Map<string, { x: number; y: number }>; width: number; height: number } {
  const positions = new Map<string, { x: number; y: number }>();

  sorted.forEach((node, index) => {
    positions.set(node.id, {
      x: leftMargin,
      y: index * (LIST_CONFIG.cellHeight + LIST_CONFIG.rowGap),
    });
  });

  const height = sorted.length * LIST_CONFIG.cellHeight + (sorted.length - 1) * LIST_CONFIG.rowGap;
  const width = leftMargin + LIST_CONFIG.cellWidth;

  return { positions, width, height };
}

function computeLineSegments(
  sorted: Node[],
  colorMap: Map<string, string>,
  childrenMap: Map<string, string[]>
): LineSegment[] {
  const indexMap = new Map(sorted.map((n, i) => [n.id, i]));
  const lines: LineSegment[] = [];
  const slotEndRows = new Map<number, number>();

  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const children = childrenMap.get(node.id) || [];

    if (children.length === 0) continue;

    const childIndices = children.map((id) => indexMap.get(id)!);
    const lastChildIndex = Math.max(...childIndices);

    let slot = 0;
    while (slotEndRows.has(slot) && slotEndRows.get(slot)! > i) {
      slot++;
    }

    slotEndRows.set(slot, lastChildIndex);

    lines.push({
      parentId: node.id,
      slot,
      startRow: i,
      endRow: lastChildIndex,
      color: colorMap.get(node.id)!,
    });
  }

  return lines;
}

function computeConnectorPositions(
  sorted: Node[],
  lines: LineSegment[],
  config: LayoutConfig
): Map<number, Map<string, number>> {
  const positions = new Map<number, Map<string, number>>();

  for (let rowIndex = 0; rowIndex < sorted.length; rowIndex++) {
    const node = sorted[rowIndex];
    const activeLines = lines.filter((l) => l.startRow <= rowIndex && l.endRow >= rowIndex);
    const connectedLines = activeLines.filter(
      (line) => line.parentId === node.id || node.dependencies.includes(line.parentId)
    );

    const sortedConnectedLines = [...connectedLines].sort((a, b) => {
      const aIsParent = a.parentId === node.id;
      const bIsParent = b.parentId === node.id;
      if (aIsParent && !bIsParent) return 1;
      if (!aIsParent && bIsParent) return -1;
      return a.slot - b.slot;
    });

    const count = sortedConnectedLines.length;
    const totalHeight = count * config.lineWidth + (count - 1) * config.lineGap;
    const startY = (config.cellHeight - totalHeight) / 2;

    const rowPositions = new Map<string, number>();
    sortedConnectedLines.forEach((line, i) => {
      rowPositions.set(line.parentId, startY + i * (config.lineWidth + config.lineGap));
    });
    positions.set(rowIndex, rowPositions);
  }

  return positions;
}

export function computeLayout(
  sorted: Node[],
  colorMap: Map<string, string>,
  config: LayoutConfig
): ComputedLayout {
  const childrenMap = buildChildrenMap(sorted);
  const lines = computeLineSegments(sorted, colorMap, childrenMap);

  const maxSlot = lines.length > 0 ? Math.max(...lines.map((l) => l.slot)) : -1;
  const leftMargin =
    maxSlot >= 0 ? (maxSlot + 1) * (config.lineWidth + config.lineGap) + config.cellGap : 0;

  const connectorPositions = computeConnectorPositions(sorted, lines, config);

  return { lines, leftMargin, connectorPositions };
}
