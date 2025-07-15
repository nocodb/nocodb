export const calculateNextPosition = (
  existingWidgets: WidgetType[],
  newWidgetDimensions: { w: number; h: number },
  gridColumns: number = 4, // 4-column grid
) => {
  if (existingWidgets.length === 0) {
    return { x: 0, y: 0 }
  }

  // Create a map of occupied positions
  const occupiedPositions = new Set<string>()
  let maxY = 0

  existingWidgets.forEach((widget) => {
    const { x, y, w, h } = widget.position
    maxY = Math.max(maxY, y + h)

    // Mark all positions this widget occupies
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        occupiedPositions.add(`${col},${row}`)
      }
    }
  })

  // Function to check if a position is available
  const isPositionAvailable = (x: number, y: number, w: number, h: number) => {
    // Check if position goes beyond grid boundaries
    if (x + w > gridColumns) return false

    // Check if any cell in this position is occupied
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        if (occupiedPositions.has(`${col},${row}`)) {
          return false
        }
      }
    }
    return true
  }

  // Try to find a position starting from the top
  for (let y = 0; y <= maxY + 1; y++) {
    for (let x = 0; x <= gridColumns - newWidgetDimensions.w; x++) {
      if (isPositionAvailable(x, y, newWidgetDimensions.w, newWidgetDimensions.h)) {
        return { x, y }
      }
    }
  }

  // If no position found, place at the bottom
  return { x: 0, y: maxY }
}
