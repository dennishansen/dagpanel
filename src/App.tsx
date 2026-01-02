import { useState, useMemo } from "react";
import "./App.css";

import type { ViewMode } from "./types";
import { COLORS, LAYOUT_CONFIG, DAG_CONFIG, LIST_CONFIG } from "./constants";
import { dag } from "./data";
import { topologicalSort, buildChildrenMap } from "./dagUtils";
import { computeDagLayers, computeDagPositions } from "./dagLayout";
import { computeListPositions, computeLayout } from "./listLayout";
import { computeUnifiedConnections } from "./connections";

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const sorted = topologicalSort(dag);
  const colorMap = useMemo(
    () => new Map(sorted.map((node, index) => [node.id, COLORS[index % COLORS.length]])),
    [sorted]
  );

  const baseLayout = computeLayout(sorted, colorMap, LAYOUT_CONFIG);
  const baseLeftMargin = baseLayout.leftMargin;
  const { lines, connectorPositions } = baseLayout;

  // DAG layout computation
  const dagChildrenMap = useMemo(() => buildChildrenMap(dag), []);
  const dagLayers = useMemo(() => computeDagLayers(dag), []);
  const dagLayout = useMemo(
    () => computeDagPositions(dag, dagLayers, dagChildrenMap),
    [dagLayers, dagChildrenMap]
  );
  const { positions: dagPositions, width: dagWidth, height: dagHeight } = dagLayout;

  // List layout computation
  const listLayout = useMemo(
    () => computeListPositions(sorted, baseLeftMargin),
    [sorted, baseLeftMargin]
  );
  const { positions: listPositions, width: listWidth, height: listHeight } = listLayout;

  // Unified connections (for animations)
  const unifiedConnections = useMemo(
    () =>
      computeUnifiedConnections(
        dag,
        sorted,
        colorMap,
        listPositions,
        lines,
        connectorPositions,
        baseLeftMargin,
        dagPositions
      ),
    [sorted, colorMap, listPositions, lines, connectorPositions, baseLeftMargin, dagPositions]
  );

  // Current dimensions and positions based on view mode
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

      <div
        className="canvas-container"
        style={{
          width: currentWidth,
          height: currentHeight,
          position: "relative",
          transition: "width 0.4s ease, height 0.4s ease",
        }}
      >
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
          {unifiedConnections.map((conn) => (
            <path
              key={conn.id}
              d={viewMode === "list" ? conn.listPath : conn.dagPath}
              stroke={conn.color}
              strokeWidth={LAYOUT_CONFIG.lineWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: "d 0.4s ease",
              }}
            />
          ))}
        </svg>

        {/* Cells */}
        {sorted.map((node) => {
          const listPos = listPositions.get(node.id);
          const dagPos = dagPositions.get(node.id);

          const x = viewMode === "list" ? listPos?.x || 0 : dagPos?.x || 0;
          const y = viewMode === "list" ? listPos?.y || 0 : dagPos?.y || 0;
          const color = colorMap.get(node.id);

          return (
            <div
              key={node.id}
              className="cell"
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
                transition:
                  "left 0.4s ease, top 0.4s ease, width 0.4s ease, border-left-width 0.4s ease, border-left-color 0.4s ease, border-bottom-width 0.4s ease, border-bottom-color 0.4s ease",
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
  );
}

export default App;
