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

export function calculateGroupHeight(group: CanvasGroup, rowHeight: number) {
  let h = GROUP_HEADER_HEIGHT + GROUP_PADDING // Base height for group header
  if (group?.isExpanded) {
    if (group.infiniteData) {
      h += (group.count || 0) * rowHeight
    } else if (group?.groupCount) {
      for (let i = 0; i < group.groupCount; i++) {
        const subGroup = group.groups.get(i)
        if (!subGroup) {
          h += GROUP_HEADER_HEIGHT + GROUP_PADDING
          continue
        }
        h += calculateGroupHeight(subGroup, rowHeight) // Recursively calculate subgroup height
      }
    }
  }
  return h
}

export function calculateGroupRange(
  groups: Map<number, CanvasGroup>,
  scrollTop: number,
  rowHeight: number,
  groupCount: number,
  viewportHeight: number,
  nested = false,
): { startIndex: number; endIndex: number; partialGroupHeight: number } {
  let currentOffset = GROUP_PADDING
  let startIndex = 0
  let endIndex = groupCount - 1
  let previousOffset = currentOffset

  for (let i = 0; i < groupCount; i++) {
    const group = groups.get(i)
    const groupHeight = calculateGroupHeight(group, rowHeight)
    // console.log('calculateGroupRange', nested, currentOffset + groupHeight - GROUP_PADDING , scrollTop )
    if (currentOffset + groupHeight - (!nested ? GROUP_PADDING : 0) > scrollTop) {
      startIndex = i
      const partialGroupHeight = (scrollTop - (previousOffset - 8)) % 50
      const viewportBottom = scrollTop + viewportHeight

      for (let j = i; j < groupCount; j++) {
        const endGroup = groups.get(j)

        const endGroupHeight = calculateGroupHeight(endGroup, rowHeight)
        if (currentOffset + endGroupHeight > viewportBottom) {
          endIndex = j
          break
        }
        currentOffset += endGroupHeight
        endIndex = j
      }

      // console.log('calculateGroupRange - ret',  startIndex, endIndex, partialGroupHeight )
      return { startIndex, endIndex, partialGroupHeight }
    }

    previousOffset = currentOffset
    currentOffset += groupHeight
    startIndex = i + 1
  }

  const partialGroupHeight = scrollTop - previousOffset
  return { startIndex, endIndex, partialGroupHeight }
}

export function generateGroupPath(data?: CanvasGroup) {
  if (!data) return []
  const path = []

  // Add groupIndex from each nestedIn entry
  if (data.nestedIn && data.nestedIn.length > 0) {
    data.nestedIn.forEach((nested) => path.push(nested.groupIndex))
  }

  return path
}
