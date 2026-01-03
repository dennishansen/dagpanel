import { useState, useMemo, useRef, useLayoutEffect } from "react";
import "./App.css";

import type { Node, ViewMode } from "./types";

// Icon components for different node types
const ICON_COLOR = "#95FF00";

const PointIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill={ICON_COLOR}>
    <circle cx="6" cy="6" r="3" />
  </svg>
);

const LineIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12">
    <line x1="3" y1="9" x2="9" y2="3" stroke={ICON_COLOR} strokeWidth="1.5" />
    <circle cx="3" cy="9" r="2" fill={ICON_COLOR} />
    <circle cx="9" cy="3" r="2" fill={ICON_COLOR} />
  </svg>
);

const PathIcon = () => (
  <svg width="11" height="11" viewBox="0 2 12 12">
    <path d="M2 10 Q6 2 10 6" stroke={ICON_COLOR} strokeWidth="1.5" fill="none" />
    <circle cx="2" cy="10" r="2" fill={ICON_COLOR} />
    <circle cx="10" cy="6" r="2" fill={ICON_COLOR} />
  </svg>
);

const PolygonIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" stroke={ICON_COLOR} strokeWidth="1.5" fill="none">
    <polygon points="6,1 11,5 9,11 3,11 1,5" />
  </svg>
);

const AreaIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12">
    <polygon
      points="6,1 11,5 9,11 3,11 1,5"
      fill={ICON_COLOR}
      fillOpacity="0.3"
      stroke={ICON_COLOR}
      strokeWidth="1.5"
    />
  </svg>
);

const ShapeIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12">
    <rect
      x="2"
      y="2"
      width="8"
      height="8"
      rx="1"
      fill={ICON_COLOR}
      fillOpacity="0.3"
      stroke={ICON_COLOR}
      strokeWidth="1.5"
    />
  </svg>
);

const getNodeIcon = (nodeName: string) => {
  const name = nodeName.toLowerCase();
  if (name.startsWith("point")) return <PointIcon />;
  if (name.startsWith("line")) return <LineIcon />;
  if (name.startsWith("path")) return <PathIcon />;
  if (name.startsWith("polygon")) return <PolygonIcon />;
  if (name.startsWith("area")) return <AreaIcon />;
  if (name.startsWith("shape")) return <ShapeIcon />;
  return null;
};
import { COLORS, LAYOUT_CONFIG, DAG_CONFIG, LIST_CONFIG } from "./constants";
import { dag } from "./data";
import { topologicalSort, buildChildrenMap } from "./dagUtils";
import { computeDagLayers, computeDagPositions } from "./dagLayout";
import { computeListPositions, computeLayout } from "./listLayout";
import { computeUnifiedConnections } from "./connections";

// Compute connector bar positions for the colored indicator
function computeConnectorBars(
  nodes: Node[],
  sorted: Node[],
  connectorPositions: Map<number, Map<string, number>>,
  childrenMap: Map<string, string[]>,
  dagPositions: Map<string, { x: number; y: number }>
): Map<
  string,
  {
    listBar: { y: number; height: number };
    dagBar: { x: number; width: number };
    dagTopBar: { x: number; width: number };
  }
> {
  const bars = new Map<
    string,
    {
      listBar: { y: number; height: number };
      dagBar: { x: number; width: number };
      dagTopBar: { x: number; width: number };
    }
  >();
  const sortedIndexMap = new Map(sorted.map((n, i) => [n.id, i]));
  const margin = 4;
  const lineWidth = LAYOUT_CONFIG.lineWidth;

  for (const node of nodes) {
    const rowIndex = sortedIndexMap.get(node.id);
    if (rowIndex === undefined) continue;

    const rowConnectors = connectorPositions.get(rowIndex);
    if (!rowConnectors || rowConnectors.size === 0) {
      // No connections - small default bar
      bars.set(node.id, {
        listBar: { y: LAYOUT_CONFIG.cellHeight / 2 - margin, height: margin * 2 },
        dagBar: { x: DAG_CONFIG.cellWidth / 2 - margin, width: margin * 2 },
        dagTopBar: { x: DAG_CONFIG.cellWidth / 2 - margin, width: margin * 2 },
      });
      continue;
    }

    // Get all Y positions for connectors at this row (both incoming parent lines and outgoing)
    const yPositions = Array.from(rowConnectors.values());
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions) + lineWidth;
    const listBarY = Math.max(0, minY - margin);
    const listBarHeight = Math.min(LAYOUT_CONFIG.cellHeight, maxY + margin) - listBarY;

    // For DAG: compute X positions of incoming connections (top) and outgoing (bottom center)
    const parents = node.dependencies;
    const children = childrenMap.get(node.id) || [];

    // DAG bar on bottom - for outgoing connections (all exit from center)
    let dagBarX = DAG_CONFIG.cellWidth / 2 - margin;
    let dagBarWidth = margin * 2;

    if (children.length > 0 || parents.length > 0) {
      dagBarX = DAG_CONFIG.cellWidth / 2 - margin;
      dagBarWidth = margin * 2;
    }

    // DAG bar on top - for incoming connections (spans all parent connectors)
    let dagTopBarX = DAG_CONFIG.cellWidth / 2 - margin;
    let dagTopBarWidth = margin * 2;

    if (parents.length > 0) {
      // Sort parents by their X position (same logic as in connections.ts)
      const sortedParents = [...parents].sort((a, b) => {
        const posA = dagPositions.get(a);
        const posB = dagPositions.get(b);
        return (posA?.x ?? 0) - (posB?.x ?? 0);
      });

      // Compute connector positions for each parent (same as connections.ts)
      const count = sortedParents.length;
      const totalWidth = count * DAG_CONFIG.lineWidth + (count - 1) * DAG_CONFIG.connectorGap;
      const startX = (DAG_CONFIG.cellWidth - totalWidth) / 2;

      const connectorXPositions: number[] = [];
      sortedParents.forEach((_, i) => {
        const connX =
          startX + i * (DAG_CONFIG.lineWidth + DAG_CONFIG.connectorGap) + DAG_CONFIG.lineWidth / 2;
        connectorXPositions.push(connX);
      });

      if (connectorXPositions.length > 0) {
        const minX = Math.min(...connectorXPositions) - DAG_CONFIG.lineWidth / 2;
        const maxX = Math.max(...connectorXPositions) + DAG_CONFIG.lineWidth / 2;
        dagTopBarX = Math.max(0, minX - margin);
        dagTopBarWidth = Math.min(DAG_CONFIG.cellWidth, maxX + margin) - dagTopBarX;
      }
    }

    bars.set(node.id, {
      listBar: { y: listBarY, height: listBarHeight },
      dagBar: { x: dagBarX, width: dagBarWidth },
      dagTopBar: { x: dagTopBarX, width: dagTopBarWidth },
    });
  }

  return bars;
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null);
  const [segmentedControlSize, setSegmentedControlSize] = useState({ width: 0, height: 44 });
  const segmentedControlRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (segmentedControlRef.current) {
      const { width, height } = segmentedControlRef.current.getBoundingClientRect();
      setSegmentedControlSize({ width, height });
    }
  }, []);

  const sorted = topologicalSort(dag);
  const colorMap = useMemo(
    () => new Map(sorted.map((node, index) => [node.id, COLORS[index % COLORS.length]])),
    [sorted]
  );

  // DAG layout computation (full)
  const dagChildrenMap = useMemo(() => buildChildrenMap(dag), []);

  // Compute connected cells for focus
  const connectedCells = useMemo(() => {
    if (!focusedCellId) return null;

    const connected = new Set<string>();
    connected.add(focusedCellId);

    // Find the focused node
    const focusedNode = dag.find((n) => n.id === focusedCellId);
    if (focusedNode) {
      // Add all dependencies (parents)
      focusedNode.dependencies.forEach((depId) => connected.add(depId));
    }

    // Add all children (nodes that depend on focused)
    const children = dagChildrenMap.get(focusedCellId);
    if (children) {
      children.forEach((childId) => connected.add(childId));
    }

    return connected;
  }, [focusedCellId, dagChildrenMap]);

  // Filter nodes for focused view
  const focusedNodes = useMemo(() => {
    if (!focusedCellId || !connectedCells) return null;
    return dag.filter((n) => connectedCells.has(n.id));
  }, [focusedCellId, connectedCells]);

  const focusedSorted = useMemo(() => {
    if (!focusedNodes) return null;
    // Filter sorted to maintain topological order but only include focused nodes
    return sorted.filter((n) => focusedNodes.some((fn) => fn.id === n.id));
  }, [focusedNodes, sorted]);

  // Full layouts (always computed)
  const fullBaseLayout = computeLayout(sorted, colorMap, LAYOUT_CONFIG);
  const fullBaseLeftMargin = fullBaseLayout.leftMargin;
  const { lines: fullLines, connectorPositions: fullConnectorPositions } = fullBaseLayout;

  const fullDagLayers = useMemo(() => computeDagLayers(dag), []);
  const fullDagLayout = useMemo(
    () => computeDagPositions(dag, fullDagLayers, dagChildrenMap),
    [fullDagLayers, dagChildrenMap]
  );

  const fullListLayout = useMemo(
    () => computeListPositions(sorted, fullBaseLeftMargin),
    [sorted, fullBaseLeftMargin]
  );

  // Compute connector bars for colored indicators
  const connectorBars = useMemo(
    () =>
      computeConnectorBars(
        dag,
        sorted,
        fullConnectorPositions,
        dagChildrenMap,
        fullDagLayout.positions
      ),
    [sorted, fullConnectorPositions, dagChildrenMap, fullDagLayout.positions]
  );

  // Focused layouts (computed when focused)
  const focusedLayouts = useMemo(() => {
    if (!focusedNodes || !focusedSorted) return null;

    // Create filtered nodes with only dependencies that exist in focused set
    const focusedNodeIds = new Set(focusedNodes.map((n) => n.id));
    const filteredNodes: Node[] = focusedNodes.map((n) => ({
      ...n,
      dependencies: n.dependencies.filter((depId) => focusedNodeIds.has(depId)),
    }));

    const focusedChildrenMap = buildChildrenMap(filteredNodes);
    const focusedDagLayers = computeDagLayers(filteredNodes);
    const focusedDagLayout = computeDagPositions(
      filteredNodes,
      focusedDagLayers,
      focusedChildrenMap
    );

    // Filter focusedSorted to match filtered nodes
    const filteredSorted = focusedSorted.map((n) => filteredNodes.find((fn) => fn.id === n.id)!);

    const focusedBaseLayout = computeLayout(filteredSorted, colorMap, LAYOUT_CONFIG);
    const focusedListLayout = computeListPositions(filteredSorted, focusedBaseLayout.leftMargin);

    const focusedConnections = computeUnifiedConnections(
      filteredNodes,
      filteredSorted,
      colorMap,
      focusedListLayout.positions,
      focusedBaseLayout.lines,
      focusedBaseLayout.connectorPositions,
      focusedBaseLayout.leftMargin,
      focusedDagLayout.positions
    );

    // Compute connector bars for focused state
    const focusedConnectorBars = computeConnectorBars(
      filteredNodes,
      filteredSorted,
      focusedBaseLayout.connectorPositions,
      focusedChildrenMap,
      focusedDagLayout.positions
    );

    return {
      dagPositions: focusedDagLayout.positions,
      dagWidth: focusedDagLayout.width,
      dagHeight: focusedDagLayout.height,
      listPositions: focusedListLayout.positions,
      listWidth: focusedListLayout.width,
      listHeight: focusedListLayout.height,
      connections: focusedConnections,
      connectorBars: focusedConnectorBars,
    };
  }, [focusedNodes, focusedSorted, colorMap]);

  // Full connections (for unfocused state)
  const fullConnections = useMemo(
    () =>
      computeUnifiedConnections(
        dag,
        sorted,
        colorMap,
        fullListLayout.positions,
        fullLines,
        fullConnectorPositions,
        fullBaseLeftMargin,
        fullDagLayout.positions
      ),
    [
      sorted,
      colorMap,
      fullListLayout.positions,
      fullLines,
      fullConnectorPositions,
      fullBaseLeftMargin,
      fullDagLayout.positions,
    ]
  );

  // Current layout values based on focus state
  const isFocused = focusedCellId !== null && focusedLayouts !== null;

  const dagPositions = isFocused ? focusedLayouts.dagPositions : fullDagLayout.positions;
  const dagWidth = isFocused ? focusedLayouts.dagWidth : fullDagLayout.width;
  const dagHeight = isFocused ? focusedLayouts.dagHeight : fullDagLayout.height;

  const listPositions = isFocused ? focusedLayouts.listPositions : fullListLayout.positions;
  const listWidth = isFocused ? focusedLayouts.listWidth : fullListLayout.width;
  const listHeight = isFocused ? focusedLayouts.listHeight : fullListLayout.height;

  // Build a map of focused connection paths for quick lookup
  const focusedConnectionPaths = useMemo(() => {
    if (!focusedLayouts) return null;
    const map = new Map<string, { listPath: string; dagPath: string }>();
    for (const conn of focusedLayouts.connections) {
      map.set(conn.id, { listPath: conn.listPath, dagPath: conn.dagPath });
    }
    return map;
  }, [focusedLayouts]);

  // Current dimensions based on view mode
  const currentWidth = viewMode === "list" ? listWidth : dagWidth;
  const currentHeight = viewMode === "list" ? listHeight : dagHeight;
  const cellWidth = viewMode === "list" ? LIST_CONFIG.cellWidth : DAG_CONFIG.cellWidth;

  return (
    <div className="app">
      <div className="header">
        <div className="segmented-control" ref={segmentedControlRef}>
          {/* SVG background and borders */}
          {segmentedControlSize.width > 0 && (
            <svg className="segmented-control-svg">
              <defs>
                <linearGradient id="segBgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(0, 114, 255, 0.22)" />
                  <stop offset="100%" stopColor="rgba(0, 114, 255, 0.07)" />
                </linearGradient>
                <linearGradient id="segBgBorderGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(0, 114, 255, 0.22)" />
                  <stop offset="50%" stopColor="rgba(0, 114, 255, 0)" />
                  <stop offset="100%" stopColor="rgba(0, 114, 255, 0.22)" />
                </linearGradient>
              </defs>
              {/* Background fill - inset 1px from border */}
              <path
                className="segmented-control-bg"
                d={`M 2 2 L ${segmentedControlSize.width - 2} 2 L ${
                  segmentedControlSize.width - 2
                } ${segmentedControlSize.height - 12.5} L ${segmentedControlSize.width - 12.5} ${
                  segmentedControlSize.height - 2
                } L 12.5 ${segmentedControlSize.height - 2} L 2 ${
                  segmentedControlSize.height - 12.5
                } Z`}
                fill="url(#segBgGrad)"
              />
              {/* Background border stroke - inset border around the fill */}
              <path
                className="segmented-control-bg-border"
                d={`M 2.5 2.5 L ${segmentedControlSize.width - 2.5} 2.5 L ${
                  segmentedControlSize.width - 2.5
                } ${segmentedControlSize.height - 12.5} L ${segmentedControlSize.width - 12.5} ${
                  segmentedControlSize.height - 2.5
                } L 12.5 ${segmentedControlSize.height - 2.5} L 2.5 ${
                  segmentedControlSize.height - 12.5
                } Z`}
                fill="none"
                stroke="url(#segBgBorderGrad)"
                strokeWidth="1"
              />
              {/* Outer border stroke */}
              <path
                className="segmented-control-border"
                d={`M 0.5 0.5 L ${segmentedControlSize.width - 0.5} 0.5 L ${
                  segmentedControlSize.width - 0.5
                } ${segmentedControlSize.height - 12} L ${segmentedControlSize.width - 12} ${
                  segmentedControlSize.height - 0.5
                } L 12 ${segmentedControlSize.height - 0.5} L 0.5 ${
                  segmentedControlSize.height - 12
                } Z`}
                fill="none"
                stroke="rgba(0, 114, 255, 0.5)"
                strokeWidth="1"
              />
            </svg>
          )}
          <button
            className={`view-toggle ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            className={`view-toggle ${viewMode === "dag" ? "active" : ""}`}
            onClick={() => setViewMode("dag")}
            title="Flow view"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5" cy="6" r="3" />
              <circle cx="19" cy="6" r="3" />
              <circle cx="12" cy="18" r="3" />
              <line x1="7" y1="8" x2="10" y2="15" />
              <line x1="17" y1="8" x2="14" y2="15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="canvas-wrapper" onClick={() => setFocusedCellId(null)}>
        <div
          className="canvas-container"
          style={{
            width: currentWidth,
            height: currentHeight,
            position: "relative",
            transition: "width 0.4s ease, height 0.4s ease",
          }}
        >
          {/* Focus highlights - rendered behind connections */}
          {sorted.map((node) => {
            const listPos = listPositions.get(node.id);
            const dagPos = dagPositions.get(node.id);
            const fallbackListPos = fullListLayout.positions.get(node.id);
            const fallbackDagPos = fullDagLayout.positions.get(node.id);

            const x =
              viewMode === "list"
                ? listPos?.x ?? fallbackListPos?.x ?? 0
                : dagPos?.x ?? fallbackDagPos?.x ?? 0;
            const y =
              viewMode === "list"
                ? listPos?.y ?? fallbackListPos?.y ?? 0
                : dagPos?.y ?? fallbackDagPos?.y ?? 0;

            const isFocusedCell = node.id === focusedCellId;

            return (
              <div
                key={`highlight-${node.id}`}
                style={{
                  position: "absolute",
                  left: x - 1,
                  top: y - 1,
                  width: cellWidth + 2,
                  height: LIST_CONFIG.cellHeight + 2,
                  background: "rgba(232, 165, 75, 0.1)",
                  clipPath:
                    "polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)",
                  boxShadow: "0 0 12px rgba(232, 165, 75, 0.15)",
                  opacity: isFocusedCell ? 1 : 0,
                  transition: "left 0.4s ease, top 0.4s ease, width 0.4s ease, opacity 0.2s ease",
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* Unified Connections SVG - animated between views */}
          <svg
            className="connections-svg"
            width={currentWidth}
            height={currentHeight}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            {fullConnections.map((conn) => {
              const isConnected =
                !connectedCells ||
                (connectedCells.has(conn.fromId) && connectedCells.has(conn.toId));

              // When focused, use focused paths for connected connections (so they animate to new positions)
              // Otherwise use full paths
              const focusedPaths = focusedConnectionPaths?.get(conn.id);
              const listPath = isFocused && focusedPaths ? focusedPaths.listPath : conn.listPath;
              const dagPath = isFocused && focusedPaths ? focusedPaths.dagPath : conn.dagPath;

              // Opacity: hidden when focused and not connected
              const opacity = isFocused ? (isConnected ? 1 : 0) : 1;

              return (
                <path
                  key={conn.id}
                  d={viewMode === "list" ? listPath : dagPath}
                  stroke={conn.color}
                  strokeWidth={LAYOUT_CONFIG.lineWidth}
                  fill="none"
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  style={{
                    transition: "d 0.4s ease, opacity 0.2s ease",
                    opacity,
                    filter: `drop-shadow(0 0 2px ${conn.color}99) drop-shadow(0 0 1px rgba(0, 0, 0, 0.4))`,
                  }}
                />
              );
            })}
          </svg>

          {/* Cells */}
          {sorted.map((node) => {
            const isConnected = !connectedCells || connectedCells.has(node.id);
            const isVisible = !isFocused || isConnected;

            // Get positions from focused or full layout
            const listPos = listPositions.get(node.id);
            const dagPos = dagPositions.get(node.id);

            // For non-connected cells when focused, use full layout positions (they'll be hidden anyway)
            const fallbackListPos = fullListLayout.positions.get(node.id);
            const fallbackDagPos = fullDagLayout.positions.get(node.id);

            const x =
              viewMode === "list"
                ? listPos?.x ?? fallbackListPos?.x ?? 0
                : dagPos?.x ?? fallbackDagPos?.x ?? 0;
            const y =
              viewMode === "list"
                ? listPos?.y ?? fallbackListPos?.y ?? 0
                : dagPos?.y ?? fallbackDagPos?.y ?? 0;
            const color = colorMap.get(node.id);

            // Opacity: hidden when focused and not connected
            const opacity = isFocused ? (isConnected ? 1 : 0) : 1;

            // Use focused connector bars when focused, fall back to full bars
            const currentConnectorBars =
              isFocused && focusedLayouts?.connectorBars
                ? focusedLayouts.connectorBars
                : connectorBars;
            const bar = currentConnectorBars.get(node.id);
            const fallbackBar = connectorBars.get(node.id);
            const listBar = bar?.listBar ?? fallbackBar?.listBar ?? { y: 0, height: 8 };
            const dagBar = bar?.dagBar ?? fallbackBar?.dagBar ?? { x: 0, width: 8 };
            const dagTopBar = bar?.dagTopBar ?? fallbackBar?.dagTopBar ?? { x: 0, width: 8 };

            return (
              <div
                key={node.id}
                className="cell"
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.id === focusedCellId) {
                    // Clicking the focused cell unfocuses
                    setFocusedCellId(null);
                    return;
                  }
                  setFocusedCellId(node.id);
                }}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: cellWidth,
                  height: LIST_CONFIG.cellHeight,
                  opacity,
                  pointerEvents: isVisible ? "auto" : "none",
                  transition: "left 0.4s ease, top 0.4s ease, width 0.4s ease, opacity 0.2s ease",
                }}
              >
                {/* Connector ports SVG */}
                <svg
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                >
                  <defs>
                    <filter id={`glow-${node.id}`} x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="1" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {/* Left connector port (list view) - trapezoid opening left */}
                  <path
                    d={`M 0 ${listBar.y - 2} L 2 ${listBar.y} L 2 ${
                      listBar.y + listBar.height
                    } L 0 ${listBar.y + listBar.height + 2} Z`}
                    fill={color}
                    filter={`url(#glow-${node.id})`}
                    style={{
                      transform: viewMode === "list" ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left center",
                      transition: "transform 0.4s ease, d 0.4s ease",
                    }}
                  />
                  {/* Bottom connector port (dag view) - trapezoid opening down */}
                  <path
                    d={`M ${dagBar.x - 2} ${LIST_CONFIG.cellHeight} L ${dagBar.x} ${
                      LIST_CONFIG.cellHeight - 2
                    } L ${dagBar.x + dagBar.width} ${LIST_CONFIG.cellHeight - 2} L ${
                      dagBar.x + dagBar.width + 2
                    } ${LIST_CONFIG.cellHeight} Z`}
                    fill={color}
                    filter={`url(#glow-${node.id})`}
                    style={{
                      transform: viewMode === "dag" ? "scaleY(1)" : "scaleY(0)",
                      transformOrigin: "center bottom",
                      transition: "transform 0.4s ease, d 0.4s ease",
                    }}
                  />
                  {/* Top connector port (dag view) - trapezoid opening up */}
                  <path
                    d={`M ${dagTopBar.x - 2} 0 L ${dagTopBar.x} 2 L ${
                      dagTopBar.x + dagTopBar.width
                    } 2 L ${dagTopBar.x + dagTopBar.width + 2} 0 Z`}
                    fill={color}
                    filter={`url(#glow-${node.id})`}
                    style={{
                      transform: viewMode === "dag" ? "scaleY(1)" : "scaleY(0)",
                      transformOrigin: "center top",
                      transition: "transform 0.4s ease, d 0.4s ease",
                    }}
                  />
                </svg>
                {/* Cell background and border SVG */}
                <svg className="cell-svg">
                  <defs>
                    <linearGradient id={`bgGrad-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(0, 114, 255, 0.22)" />
                      <stop offset="100%" stopColor="rgba(0, 114, 255, 0.07)" />
                    </linearGradient>
                    <linearGradient id={`bgBorderGrad-${node.id}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(0, 114, 255, 0.22)" />
                      <stop offset="50%" stopColor="rgba(0, 114, 255, 0)" />
                      <stop offset="100%" stopColor="rgba(0, 114, 255, 0.22)" />
                    </linearGradient>
                  </defs>
                  {/* Background fill - inset 1px from border */}
                  <path
                    className="cell-bg"
                    d={`M 2 2 L ${cellWidth - 2} 2 L ${cellWidth - 2} ${
                      LIST_CONFIG.cellHeight - 12.5
                    } L ${cellWidth - 12.5} ${LIST_CONFIG.cellHeight - 2} L 2 ${
                      LIST_CONFIG.cellHeight - 2
                    } Z`}
                    fill={`url(#bgGrad-${node.id})`}
                  />
                  {/* Background border stroke - inset border around the fill */}
                  <path
                    className="cell-bg-border"
                    d={`M 2.5 2.5 L ${cellWidth - 2.5} 2.5 L ${cellWidth - 2.5} ${
                      LIST_CONFIG.cellHeight - 12.5
                    } L ${cellWidth - 12.5} ${LIST_CONFIG.cellHeight - 2.5} L 2.5 ${
                      LIST_CONFIG.cellHeight - 2.5
                    } Z`}
                    fill="none"
                    stroke={`url(#bgBorderGrad-${node.id})`}
                    strokeWidth="1"
                  />
                  {/* Outer border stroke */}
                  <path
                    className="cell-border"
                    d={`M 0.5 0.5 L ${cellWidth - 0.5} 0.5 L ${cellWidth - 0.5} ${
                      LIST_CONFIG.cellHeight - 12
                    } L ${cellWidth - 12} ${LIST_CONFIG.cellHeight - 0.5} L 0.5 ${
                      LIST_CONFIG.cellHeight - 0.5
                    } Z`}
                    fill="none"
                    stroke="rgba(0, 114, 255, 0.5)"
                    strokeWidth="1"
                  />
                </svg>
                <span
                  className="node-name"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform:
                      viewMode === "list"
                        ? `translate(${16 - LIST_CONFIG.cellWidth / 2}px, -50%)`
                        : "translate(-50%, -50%)",
                    transition: "transform 0.4s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {getNodeIcon(node.name)}
                  {node.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
