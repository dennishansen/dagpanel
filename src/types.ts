export type Node = {
  id: string;
  name: string;
  dependencies: string[];
};

export type LineSegment = {
  parentId: string;
  slot: number;
  startRow: number;
  endRow: number;
  color: string;
};

export type LayoutConfig = {
  lineWidth: number;
  lineGap: number;
  cellGap: number;
  cellHeight: number;
  rowGap: number;
  cornerRadius: number;
};

export type ComputedLayout = {
  lines: LineSegment[];
  leftMargin: number;
  connectorPositions: Map<number, Map<string, number>>;
};

export type ViewMode = "list" | "dag";

export type DagPosition = {
  row: number;
  col: number;
  x: number;
  y: number;
};

export type UnifiedConnection = {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  listPath: string;
  dagPath: string;
};
