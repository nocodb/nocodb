import { WidgetType } from '.';

export const calculateNextPosition = (
  existingWidgets: WidgetType[],
  newWidgetDimensions: { w: number; h: number },
  gridColumns: number = 4
) => {
  if (existingWidgets.length === 0) {
    return { x: 0, y: 0 };
  }

  const { w: newW, h: newH } = newWidgetDimensions;

  // Early return if widget is too wide
  if (newW > gridColumns) {
    return { x: 0, y: 0 };
  }

  // Create a 2D grid to track occupied cells more efficiently
  const grid = new Map<number, Set<number>>();
  let maxY = 0;

  // Build the occupation map
  for (const widget of existingWidgets) {
    const { x, y, w, h } = widget.position;
    const endY = y + h;
    maxY = Math.max(maxY, endY);

    for (let row = y; row < endY; row++) {
      if (!grid.has(row)) {
        grid.set(row, new Set());
      }
      const rowSet = grid.get(row)!;
      for (let col = x; col < x + w; col++) {
        rowSet.add(col);
      }
    }
  }

  // position checking
  const isPositionAvailable = (x: number, y: number): boolean => {
    for (let row = y; row < y + newH; row++) {
      const rowSet = grid.get(row);
      if (rowSet) {
        for (let col = x; col < x + newW; col++) {
          if (rowSet.has(col)) return false;
        }
      }
    }
    return true;
  };

  // Find the first available position, scanning row by row
  const maxX = gridColumns - newW;
  for (let y = 0; y <= maxY + 1; y++) {
    for (let x = 0; x <= maxX; x++) {
      if (isPositionAvailable(x, y)) {
        return { x, y };
      }
    }
  }

  // Fallback: place at bottom-left
  return { x: 0, y: maxY };
};
