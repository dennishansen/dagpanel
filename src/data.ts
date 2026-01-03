import type { Node } from "./types";

export const dag: Node[] = [
  { id: "point-a", name: "Point A", dependencies: [] },
  { id: "point-b", name: "Point B", dependencies: [] },
  { id: "point-c", name: "Point C", dependencies: [] },
  { id: "point-d", name: "Point D", dependencies: [] },
  { id: "line-1", name: "Line 1", dependencies: ["point-a", "point-b"] },
  { id: "line-2", name: "Line 2", dependencies: ["point-b", "point-c"] },
  { id: "line-3", name: "Line 3", dependencies: ["point-c", "point-d"] },
  // { id: "line-4", name: "Line 4", dependencies: ["point-d", "point-a"] },
  { id: "path-1", name: "Path 1", dependencies: ["line-1", "line-2"] },
  { id: "path-2", name: "Path 2", dependencies: ["line-1", "line-2", "line-3", "line-4"] },
  { id: "area-1", name: "Area 1", dependencies: ["path-2"] },
  { id: "shape-1", name: "Shape 1", dependencies: ["area-1", "path-1"] },
];
