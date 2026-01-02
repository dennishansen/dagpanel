import type { LayoutConfig } from "./types";

export const COLORS = [
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

export const LAYOUT_CONFIG: LayoutConfig = {
  lineWidth: 4,
  lineGap: 4,
  cellGap: 4,
  cellHeight: 64,
  rowGap: 8,
  cornerRadius: 8,
};

export const DAG_CONFIG = {
  cellWidth: 120,
  cellHeight: 64,
  horizontalGap: 24,
  verticalGap: 48,
  lineWidth: 4,
  lineGap: 4,
  cornerRadius: 8,
  stubLength: 8,
  connectorGap: 4,
};

export const LIST_CONFIG = {
  cellWidth: 300,
  cellHeight: 64,
  rowGap: 8,
};

