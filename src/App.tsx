import { useState } from "react";
import "./App.css";

// =============================================================================
// Types
// =============================================================================

type Node = {
  id: string;
  name: string;
  dependencies: string[];
};

type LineSegment = {
  parentId: string;
  slot: number;
  startRow: number;
  endRow: number;
  color: string;
};

type LayoutConfig = {
  lineWidth: number;
  lineGap: number;
  cellGap: number;
  cellHeight: number;
  rowGap: number;
  cornerRadius: number;
};

type ComputedLayout = {
  lines: LineSegment[];
  maxSlot: number;
  leftMargin: number;
  connectorPositions: Map<number, Map<string, number>>;
};

// =============================================================================
// Constants
// =============================================================================

const COLORS = [
  "#E63946", // red
  "#F4A261", // orange
  "#E9C46A", // yellow
  "#2A9D8F", // teal
  "#45B7D1", // cyan
  "#4361EE", // blue
  "#7209B7", // purple
  "#F72585", // magenta
  "#06D6A0", // mint
  "#FF6B35", // coral
  "#118AB2", // ocean blue
  "#9B5DE5", // lavender
];

const LAYOUT_CONFIG: LayoutConfig = {
  lineWidth: 4,
  lineGap: 4,
  cellGap: 4,
  cellHeight: 64,
  rowGap: 8,
  cornerRadius: 8,
};

// DAG: geometry hierarchy
const dag: Node[] = [
  { id: "point-a", name: "Point A", dependencies: [] },
  { id: "point-b", name: "Point B", dependencies: [] },
  { id: "point-c", name: "Point C", dependencies: [] },
  { id: "point-d", name: "Point D", dependencies: [] },
  { id: "line-1", name: "Line 1", dependencies: ["point-a", "point-b"] },
  { id: "line-2", name: "Line 2", dependencies: ["point-b", "point-c"] },
  { id: "line-3", name: "Line 3", dependencies: ["point-c", "point-d"] },
  { id: "line-4", name: "Line 4", dependencies: ["point-d", "point-a"] },
  { id: "path-1", name: "Path 1", dependencies: ["line-1", "line-2"] },
  { id: "polygon-1", name: "Polygon 1", dependencies: ["line-1", "line-2", "line-3", "line-4"] },
  { id: "area-1", name: "Area 1", dependencies: ["polygon-1"] },
  { id: "shape-1", name: "Shape 1", dependencies: ["area-1", "path-1"] },
];

// =============================================================================
// DAG Utilities
// =============================================================================

function topologicalSort(nodes: Node[]): Node[] {
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

function buildChildrenMap(nodes: Node[]): Map<string, string[]> {
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

// =============================================================================
// Layout Computation
// =============================================================================

function computeLineSegments(
  sorted: Node[],
  colorMap: Map<string, string>,
  filterToNodeId: string | null,
  childrenMap: Map<string, string[]>
): LineSegment[] {
  const indexMap = new Map(sorted.map((n, i) => [n.id, i]));

  let parentIdsToInclude: Set<string> | null = null;
  if (filterToNodeId) {
    const node = sorted.find((n) => n.id === filterToNodeId);
    if (node) {
      parentIdsToInclude = new Set<string>();
      parentIdsToInclude.add(filterToNodeId);
      for (const depId of node.dependencies) {
        parentIdsToInclude.add(depId);
      }
    }
  }

  const lines: LineSegment[] = [];
  const slotEndRows = new Map<number, number>();

  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const allChildren = childrenMap.get(node.id) || [];

    if (allChildren.length === 0) continue;
    if (parentIdsToInclude && !parentIdsToInclude.has(node.id)) continue;

    let relevantChildren = allChildren;
    if (filterToNodeId && parentIdsToInclude) {
      if (node.id !== filterToNodeId) {
        relevantChildren = allChildren.filter((childId) => childId === filterToNodeId);
      }
    }

    if (relevantChildren.length === 0) continue;

    const childIndices = relevantChildren.map((id) => indexMap.get(id)!);
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
    const activeLines = lines.filter(
      (l) => l.startRow <= rowIndex && l.endRow >= rowIndex
    );
    const connectedLines = activeLines.filter(
      (line) =>
        line.parentId === node.id ||
        node.dependencies.includes(line.parentId)
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

function computeLayout(
  sorted: Node[],
  colorMap: Map<string, string>,
  hoveredNodeId: string | null,
  config: LayoutConfig
): ComputedLayout {
  const childrenMap = buildChildrenMap(sorted);
  const lines = computeLineSegments(sorted, colorMap, hoveredNodeId, childrenMap);

  const maxSlot = lines.length > 0 ? Math.max(...lines.map((l) => l.slot)) : -1;
  const leftMargin = maxSlot >= 0 ? (maxSlot + 1) * (config.lineWidth + config.lineGap) + config.cellGap : 0;

  const connectorPositions = computeConnectorPositions(sorted, lines, config);

  return { lines, maxSlot, leftMargin, connectorPositions };
}

// =============================================================================
// SVG Path Generation
// =============================================================================

type ConnectorInfo = {
  line: LineSegment;
  connectorIndex: number;
  totalConnectors: number;
  isParent: boolean;
  wrapDepth: number; // How many corners this one wraps (for radius calculation)
};

function generateLinePaths(
  line: LineSegment,
  rowIndex: number,
  sorted: Node[],
  connectorPositions: Map<number, Map<string, number>>,
  config: LayoutConfig,
  containerWidth: number,
  connectorInfo: ConnectorInfo | null
): { verticalPath: string; horizontalPath: string | null } {
  const { lineWidth, lineGap, cellGap, cellHeight, rowGap, cornerRadius } = config;
  const node = sorted[rowIndex];
  const isStart = line.startRow === rowIndex;
  const isEnd = line.endRow === rowIndex;
  const isLastRow = rowIndex === sorted.length - 1;
  const hasConnector = connectorInfo !== null;

  // X position of vertical line center (from left edge of container)
  const slotX = containerWidth - cellGap - line.slot * (lineWidth + lineGap) - lineWidth / 2;

  // Get Y positions
  const connectorY = connectorPositions.get(rowIndex)?.get(line.parentId);
  const startConnectorY = connectorPositions.get(line.startRow)?.get(line.parentId) ?? cellHeight / 2;
  const endConnectorY = connectorPositions.get(line.endRow)?.get(line.parentId) ?? cellHeight / 2;

  // Row height includes the gap below (except for last row)
  const rowHeight = isLastRow ? cellHeight : cellHeight + rowGap;

  // Vertical line bounds
  let vTop = 0;
  let vBottom = rowHeight;

  if (isStart) {
    vTop = startConnectorY + lineWidth / 2;
  }
  if (isEnd) {
    vBottom = endConnectorY + lineWidth / 2;
  }

  let verticalPath = "";
  let horizontalPath: string | null = null;

  if (hasConnector && connectorY !== undefined) {
    const connectorCenterY = connectorY + lineWidth / 2;
    const { isParent, wrapDepth } = connectorInfo;

    // Calculate radius based on corner wrapping
    // Parent curves DOWN - doesn't wrap any corners, gets base radius
    // Children curve UP - radius increases based on how many corners they wrap
    const radiusOffset = isParent ? 0 : wrapDepth * (lineWidth + lineGap);
    const r = Math.min(
      cornerRadius + radiusOffset,
      Math.abs(containerWidth - slotX - cellGap)
    );

    // Determine if we need to draw above and/or below the connector
    const hasAbove = !isStart || vTop < connectorCenterY;
    const hasBelow = !isEnd || vBottom > connectorCenterY;

    // Build vertical path segments
    const segments: string[] = [];

    if (hasAbove && vTop < connectorCenterY - r) {
      segments.push(`M ${slotX} ${vTop} L ${slotX} ${connectorCenterY - r}`);
    }

    if (hasBelow && vBottom > connectorCenterY + r) {
      segments.push(`M ${slotX} ${connectorCenterY + r} L ${slotX} ${vBottom}`);
    }

    if (isStart && !isEnd) {
      segments.length = 0;
      segments.push(`M ${slotX} ${connectorCenterY + r} L ${slotX} ${vBottom}`);
    }

    if (isEnd && !isStart) {
      segments.length = 0;
      segments.push(`M ${slotX} ${vTop} L ${slotX} ${connectorCenterY - r}`);
    }

    if (isStart && isEnd) {
      segments.length = 0;
    }

    verticalPath = segments.join(" ");

    const cellEdgeX = containerWidth;

    if (isParent) {
      // Parent: horizontal curves DOWN into vertical going to children
      horizontalPath = `
        M ${cellEdgeX} ${connectorCenterY}
        L ${slotX + r} ${connectorCenterY}
        Q ${slotX} ${connectorCenterY} ${slotX} ${connectorCenterY + r}
      `;
    } else {
      // Child: horizontal curves UP to connect to parent above
      horizontalPath = `
        M ${cellEdgeX} ${connectorCenterY}
        L ${slotX + r} ${connectorCenterY}
        Q ${slotX} ${connectorCenterY} ${slotX} ${connectorCenterY - r}
      `;
      
      if (!isEnd) {
        verticalPath = `M ${slotX} ${vTop} L ${slotX} ${vBottom}`;
      }
    }
  } else {
    // No connector, just vertical pass-through
    verticalPath = `M ${slotX} ${vTop} L ${slotX} ${vBottom}`;
  }

  return { verticalPath, horizontalPath };
}

// =============================================================================
// Component
// =============================================================================

function App() {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const sorted = topologicalSort(dag);
  const colorMap = new Map(
    sorted.map((node, index) => [node.id, COLORS[index % COLORS.length]])
  );

  const baseLayout = computeLayout(sorted, colorMap, null, LAYOUT_CONFIG);
  const baseLeftMargin = baseLayout.leftMargin;

  const layout = computeLayout(sorted, colorMap, hoveredNodeId, LAYOUT_CONFIG);
  const { lines, connectorPositions } = layout;
  const { lineWidth, cellHeight, rowGap } = LAYOUT_CONFIG;

  return (
    <div className="container">
      {sorted.map((node, rowIndex) => {
        const activeLines = lines.filter(
          (l) => l.startRow <= rowIndex && l.endRow >= rowIndex
        );

        // Determine connected lines and their order for concentric radius calculation
        const connectedLines = activeLines.filter(
          (line) =>
            line.parentId === node.id ||
            node.dependencies.includes(line.parentId)
        );

        // Sort connected lines: children (by slot) first, parent last
        // This matches the Y-position order from computeConnectorPositions
        const sortedConnectedLines = [...connectedLines].sort((a, b) => {
          const aIsParent = a.parentId === node.id;
          const bIsParent = b.parentId === node.id;
          if (aIsParent && !bIsParent) return 1;
          if (!aIsParent && bIsParent) return -1;
          return a.slot - b.slot;
        });

        // Build a map from line parentId to connector info
        // Calculate wrapDepth for children based on corner wrapping rules
        const connectorInfoMap = new Map<string, ConnectorInfo>();
        const wrapDepths: number[] = [];
        let maxWrapDepth = 0;

        sortedConnectedLines.forEach((line, index) => {
          const isParent = line.parentId === node.id;
          let wrapDepth = 0;

          if (!isParent && index > 0) {
            // Check if this child directly wraps the previous connector
            // "Directly wrapping" = one vertical slot away AND one horizontal slot away
            const prevLine = sortedConnectedLines[index - 1];
            const prevIsParent = prevLine.parentId === node.id;
            
            // Previous connector is "one horizontal slot away" (it's index - 1)
            // Check if it's also "one vertical slot away" (slot differs by exactly 1)
            const isOneVerticalSlotAway = line.slot - prevLine.slot === 1;
            const prevIsChild = !prevIsParent;

            if (prevIsChild && isOneVerticalSlotAway) {
              // Directly wrapping the previous corner - increment from its depth
              wrapDepth = wrapDepths[index - 1] + 1;
            } else {
              // Not directly wrapping - use max depth seen so far
              wrapDepth = maxWrapDepth;
            }
          }

          wrapDepths.push(wrapDepth);
          maxWrapDepth = Math.max(maxWrapDepth, wrapDepth);

          connectorInfoMap.set(line.parentId, {
            line,
            connectorIndex: index,
            totalConnectors: sortedConnectedLines.length,
            isParent,
            wrapDepth,
          });
        });

        const isLastRow = rowIndex === sorted.length - 1;
        const rowHeight = isLastRow ? cellHeight : cellHeight + rowGap;

        return (
          <div key={node.id} className="row" style={{ paddingLeft: baseLeftMargin }}>
            <svg
              className="lines-svg"
              width={baseLeftMargin}
              height={rowHeight}
              style={{ left: 0, top: 0 }}
            >
              {activeLines.map((line) => {
                const connectorInfo = connectorInfoMap.get(line.parentId) ?? null;
                const { verticalPath, horizontalPath } = generateLinePaths(
                  line,
                  rowIndex,
                  sorted,
                  connectorPositions,
                  LAYOUT_CONFIG,
                  baseLeftMargin,
                  connectorInfo
                );

                return (
                  <g key={line.parentId}>
                    {verticalPath && (
                      <path
                        d={verticalPath}
                        stroke={line.color}
                        strokeWidth={lineWidth}
                        fill="none"
                        strokeLinecap="round"
                      />
                    )}
                    {horizontalPath && (
                      <path
                        d={horizontalPath}
                        stroke={line.color}
                        strokeWidth={lineWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            <div
              className="cell"
              style={{ borderLeftColor: colorMap.get(node.id) }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
            >
              <span className="node-name">{node.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;
