import { GROUP_HEADER_HEIGHT, GROUP_PADDING } from './constants'

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

function calculateGroupHeight(group: CanvasGroup, rowHeight: number) {
  let h = GROUP_HEADER_HEIGHT + GROUP_PADDING // Base height for group header
  if (group?.isExpanded) {
    if (group.infiniteData) {
      h += (group.count || 0) * rowHeight // Rows
    } else if (group?.groups) {
      for (const [, subGroup] of group.groups) {
        h += calculateGroupHeight(subGroup, rowHeight) // Recursively calculate subgroup height
      }
    }
  }
  return h
}

export function calculateStartGroupIndex(
  groups: Map<number, CanvasGroup>,
  scrollTop: number,
  rowHeight: number,
  groupCount: number,
) {
  let currentOffset = 32 + GROUP_PADDING // Initial offset from yOffset
  let startIndex = 0

  for (let i = 0; i < groupCount; i++) {
    const group = groups.get(i)
    const groupHeight = calculateGroupHeight(group, rowHeight)

    if (currentOffset + groupHeight > scrollTop) {
      // This group starts at or after scrollTop
      return i
    }

    currentOffset += groupHeight
    startIndex = i + 1 // Move to next group if not yet at scrollTop
  }

  return startIndex // Default to last index if scrollTop exceeds content
}
