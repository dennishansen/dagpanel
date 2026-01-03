import type { LayoutConfig } from "./types";

export const COLORS = [
  "#E8A54B", // warm amber
  "#4682AF", // steel blue
  "#C75D5D", // dusty red
  "#7B9E6B", // sage green
  "#9B7EBD", // muted lavender
  "#5A9EC0", // soft blue
  "#D4853D", // copper orange
  "#6B8FA3", // slate blue
  "#C4956A", // caramel
  "#5D8A66", // forest green
  "#B07AA1", // mauve
  "#3A7E9A", // deep blue
];

export const LAYOUT_CONFIG: LayoutConfig = {
  lineWidth: 1,
  lineGap: 4,
  cellGap: 4,
  cellHeight: 44,
  rowGap: 8,
  cornerRadius: 8,
};

export const DAG_CONFIG = {
  cellWidth: 128,
  cellHeight: 44,
  horizontalGap: 24,
  verticalGap: 48,
  lineWidth: 1,
  lineGap: 4,
  cornerRadius: 8,
  stubLength: 8,
  connectorGap: 4,
};

export const LIST_CONFIG = {
  cellWidth: 220,
  cellHeight: 44,
  rowGap: 4,
};
