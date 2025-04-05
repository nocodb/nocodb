export function getBackgroundColor(depth: number, maxDepth: number): string {
  if (maxDepth === 3) {
    switch (depth) {
      case 2:
        return '#F9F9FA'
      case 1:
        return '#F4F4F5'
      default:
        return '#F1F1F1'
    }
  }

  if (maxDepth === 2) {
    switch (depth) {
      case 1:
        return '#F9F9FA'
      default:
        return '#F4F4F5'
    }
  }

  return '#F9F9FA'
}
