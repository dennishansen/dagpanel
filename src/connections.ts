import type { Node, LineSegment, DagPosition, UnifiedConnection } from "./types";
import { LAYOUT_CONFIG, DAG_CONFIG } from "./constants";

export function computeUnifiedConnections(
  nodes: Node[],
  sorted: Node[],
  colorMap: Map<string, string>,
  listPositions: Map<string, { x: number; y: number }>,
  listLines: LineSegment[],
  listConnectorPositions: Map<number, Map<string, number>>,
  baseLeftMargin: number,
  dagPositions: Map<string, DagPosition>
): UnifiedConnection[] {
  const connections: UnifiedConnection[] = [];
  const { lineWidth, lineGap, cellHeight } = LAYOUT_CONFIG;
  const sortedIndexMap = new Map(sorted.map((n, i) => [n.id, i]));

  const listLineMap = new Map<string, LineSegment>();
  for (const line of listLines) {
    listLineMap.set(line.parentId, line);
  }

  // Compute child connector positions for DAG
  // Each child has vertical stubs for each parent, centered with gaps
  const dagChildConnectors = new Map<string, Map<string, number>>();

  for (const node of nodes) {
    if (node.dependencies.length === 0) continue;

    const nodePos = dagPositions.get(node.id);
    if (!nodePos) continue;

    // Sort parents by their X position to minimize crossings
    const sortedParents = [...node.dependencies].sort((a, b) => {
      const posA = dagPositions.get(a);
      const posB = dagPositions.get(b);
      return (posA?.x ?? 0) - (posB?.x ?? 0);
    });

    const count = sortedParents.length;
    const totalWidth = count * DAG_CONFIG.lineWidth + (count - 1) * DAG_CONFIG.connectorGap;
    const startX = (DAG_CONFIG.cellWidth - totalWidth) / 2;

    const connectors = new Map<string, number>();
    sortedParents.forEach((parentId, i) => {
      connectors.set(
        parentId,
        startX + i * (DAG_CONFIG.lineWidth + DAG_CONFIG.connectorGap) + DAG_CONFIG.lineWidth / 2
      );
    });
    dagChildConnectors.set(node.id, connectors);
  }

  for (const node of nodes) {
    for (const depId of node.dependencies) {
      const color = colorMap.get(depId) || "#888";
      const id = `${depId}-${node.id}`;

      // ========== LIST PATH ==========
      let listPath = "";
      const parentListPos = listPositions.get(depId);
      const childListPos = listPositions.get(node.id);
      const listLine = listLineMap.get(depId);

      if (parentListPos && childListPos && listLine) {
        const parentRowIndex = sortedIndexMap.get(depId) || 0;
        const childRowIndex = sortedIndexMap.get(node.id) || 0;

        const parentConnY =
          listConnectorPositions.get(parentRowIndex)?.get(depId) ?? cellHeight / 2;
        const childConnY = listConnectorPositions.get(childRowIndex)?.get(depId) ?? cellHeight / 2;

        const slotX =
          baseLeftMargin -
          LAYOUT_CONFIG.cellGap -
          listLine.slot * (lineWidth + lineGap) -
          lineWidth / 2;

        const fromX = baseLeftMargin;
        const fromY = parentListPos.y + parentConnY + lineWidth / 2;
        const toX = baseLeftMargin;
        const toY = childListPos.y + childConnY + lineWidth / 2;
        
        // Clamp corner radius to available horizontal space
        const horizontalDist = fromX - slotX;
        const r = Math.min(LAYOUT_CONFIG.cornerRadius, horizontalDist);

        // 6-segment path: M, L, Q, L, Q, L
        listPath = `
          M ${fromX} ${fromY}
          L ${slotX + r} ${fromY}
          Q ${slotX} ${fromY} ${slotX} ${fromY + r}
          L ${slotX} ${toY - r}
          Q ${slotX} ${toY} ${slotX + r} ${toY}
          L ${toX} ${toY}
        `;
      }

      // ========== DAG PATH (diagonal with vertical stubs and rounded corners) ==========
      let dagPath = "";
      const parentDagPos = dagPositions.get(depId);
      const childDagPos = dagPositions.get(node.id);

      if (parentDagPos && childDagPos) {
        // Parent outputs from center bottom
        const parentCenterX = DAG_CONFIG.cellWidth / 2;
        // Child receives at its specific connector position
        const childConnectorX =
          dagChildConnectors.get(node.id)?.get(depId) ?? DAG_CONFIG.cellWidth / 2;

        const fromX = parentDagPos.x + parentCenterX;
        const fromY = parentDagPos.y + DAG_CONFIG.cellHeight;
        const toX = childDagPos.x + childConnectorX;
        const toY = childDagPos.y;

        const stubEndY = fromY + DAG_CONFIG.stubLength;
        const stubStartY = toY - DAG_CONFIG.stubLength;
        const r = DAG_CONFIG.cornerRadius;

        // Calculate diagonal direction for proper corner curves
        const dx = toX - fromX;
        const dy = stubStartY - stubEndY;
        const length = Math.sqrt(dx * dx + dy * dy);

        // If diagonal is long enough for rounded corners
        if (length > 2 * r) {
          // Normalized direction along the diagonal
          const ux = dx / length;
          const uy = dy / length;

          // First corner: end of parent stub, start of diagonal
          const c1StartY = stubEndY - r;
          const c1EndX = fromX + r * ux;
          const c1EndY = stubEndY + r * uy;

          // Second corner: end of diagonal, start of child stub
          const c2StartX = toX - r * ux;
          const c2StartY = stubStartY - r * uy;
          const c2EndY = stubStartY + r;

          // 6-segment path with proper rounded corners
          dagPath = `
            M ${fromX} ${fromY}
            L ${fromX} ${c1StartY}
            Q ${fromX} ${stubEndY} ${c1EndX} ${c1EndY}
            L ${c2StartX} ${c2StartY}
            Q ${toX} ${stubStartY} ${toX} ${c2EndY}
            L ${toX} ${toY}
          `;
        } else {
          // Fallback for short diagonals: use smaller radius or straight
          const smallR = Math.max(length / 4, 1);
          const ux = length > 0 ? dx / length : 0;
          const uy = length > 0 ? dy / length : 1;

          dagPath = `
            M ${fromX} ${fromY}
            L ${fromX} ${stubEndY - smallR}
            Q ${fromX} ${stubEndY} ${fromX + smallR * ux} ${stubEndY + smallR * uy}
            L ${toX - smallR * ux} ${stubStartY - smallR * uy}
            Q ${toX} ${stubStartY} ${toX} ${stubStartY + smallR}
            L ${toX} ${toY}
          `;
        }
      }

      if (listPath && dagPath) {
        connections.push({ id, fromId: depId, toId: node.id, color, listPath, dagPath });
      }
    }
  }

  return connections;
}
