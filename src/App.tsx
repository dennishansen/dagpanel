import { useState, useMemo } from "react";
import "./App.css";

import type { Node, ViewMode } from "./types";
import { COLORS, LAYOUT_CONFIG, DAG_CONFIG, LIST_CONFIG } from "./constants";
import { dag } from "./data";
import { topologicalSort, buildChildrenMap } from "./dagUtils";
import { computeDagLayers, computeDagPositions } from "./dagLayout";
import { computeListPositions, computeLayout } from "./listLayout";
import { computeUnifiedConnections } from "./connections";

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null);

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

    return {
      dagPositions: focusedDagLayout.positions,
      dagWidth: focusedDagLayout.width,
      dagHeight: focusedDagLayout.height,
      listPositions: focusedListLayout.positions,
      listWidth: focusedListLayout.width,
      listHeight: focusedListLayout.height,
      connections: focusedConnections,
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
        <button
          className={`view-toggle ${viewMode === "list" ? "active" : ""}`}
          onClick={() => setViewMode("list")}
        >
          List
        </button>
        <button
          className={`view-toggle ${viewMode === "dag" ? "active" : ""}`}
          onClick={() => setViewMode("dag")}
        >
          Flow
        </button>
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
                  left: x - 4,
                  top: y - 4,
                  width: cellWidth + 8,
                  height: LIST_CONFIG.cellHeight + 8,
                  background: "#e8e8e8",
                  borderRadius: 10,
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
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "d 0.4s ease, opacity 0.2s ease",
                    opacity,
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
                  borderLeftWidth: viewMode === "list" ? 4 : 1,
                  borderLeftColor: viewMode === "list" ? color : "#e0e0e0",
                  borderBottomWidth: viewMode === "list" ? 1 : 4,
                  borderBottomColor: viewMode === "list" ? "#e0e0e0" : color,
                  opacity,
                  pointerEvents: isVisible ? "auto" : "none",
                  transition:
                    "left 0.4s ease, top 0.4s ease, width 0.4s ease, border-left-width 0.4s ease, border-left-color 0.4s ease, border-bottom-width 0.4s ease, border-bottom-color 0.4s ease, opacity 0.2s ease",
                }}
              >
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
                  }}
                >
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
