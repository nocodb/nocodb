import { UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import { COLUMN_HEADER_HEIGHT_IN_PX, GROUP_EXPANDED_BOTTOM_PADDING, GROUP_HEADER_HEIGHT, GROUP_PADDING } from './constants'

export function getGroupColors(depth: number, maxDepth: number) {
  depth = depth + 1
  if (maxDepth === 1) {
    return {
      border: '#E7E7E9',
      background: '#FFF',
      aggregation: {
        hover: '#F9F9FA', // Hover State
        default: '#FFF', // Default Bg State
        border: '#F4F4F5',
      },
    }
  }

  if (maxDepth === 2) {
    switch (depth) {
      case 2: {
        return {
          background: '#FFF',
          border: '#E7E7E9',
          aggregation: {
            hover: '#F9F9FA', // Hover State
            default: '#FFF', // Default Bg State
            border: '#F4F4F5',
          },
        }
      }
      case 1: {
        return {
          background: '#F9F9FA',
          border: '#d5d5d9',
          aggregation: {
            hover: '#F4F4F5', // Hover State
            default: '#F9F9FA', // Default Bg State
            border: '#E7E7E8',
          },
        }
      }
    }
  }

  if (maxDepth === 3) {
    switch (depth) {
      case 3: {
        return {
          background: '#FFF',
          border: '#E7E7E9',
          aggregation: {
            hover: '#F9F9FA', // Hover State
            default: '#FFF', // Default Bg State
            border: '#F4F4F5',
          },
        }
      }
      case 2: {
        return {
          background: '#F9F9FA',
          border: '#d5d5d9',
          aggregation: {
            hover: '#F4F4F5', // Hover State
            default: '#F9F9FA', // Default Bg State
            border: '#E7E7E8',
          },
        }
      }
      case 1: {
        return {
          background: '#F4F4F5',
          border: '#9AA2AF',
          aggregation: {
            hover: '#E7E7E8', // Hover State
            default: '#F4F4F5', // Default Bg State
            border: '#E7E7E9',
          },
        }
      }
    }
  }

  return {
    background: '#FFF',
    border: '#E7E7E9',
    aggregation: {
      hover: '#F9F9FA', // Hover State
      default: '#FFF', // Default Bg State
      border: '#F4F4F5',
    },
  }
}

export function getBackgroundColor(depth: number, maxDepth: number): string {
  depth = depth + 1

  if (maxDepth === 3) {
    switch (depth) {
      case 3:
        return '#F9F9FA'
      case 2:
        return '#F4F4F5'
      case 1:
        return '#F1F1F1'
    }
  }

  if (maxDepth === 2) {
    switch (depth) {
      case 1:
        return '#F4F4F5'
      case 2:
        return '#F9F9FA'
    }
  }

  return '#F9F9FA'
}

export function calculateGroupHeight(group: CanvasGroup, rowHeight: number, isAddingNewRowAllowed?: boolean) {
  let h = GROUP_HEADER_HEIGHT + GROUP_PADDING // Base height for group header
  if (group?.isExpanded) {
    if (group.path) {
      h += (group.count || 0) * rowHeight
      if (isAddingNewRowAllowed) {
        h += COLUMN_HEADER_HEIGHT_IN_PX
      }
      // 1 Px Offset is Added for Showing the activeBorders. Else it wont be visible
      h += 1
    } else if (group?.groupCount) {
      // add group padding if expanded since there will be top padding in the beginning of the group
      h += GROUP_EXPANDED_BOTTOM_PADDING
      for (let i = 0; i < group?.groupCount; i++) {
        const subGroup = group.groups.get(i)
        if (!subGroup) {
          h += GROUP_HEADER_HEIGHT + GROUP_PADDING
          continue
        }
        h += calculateGroupHeight(subGroup, rowHeight, isAddingNewRowAllowed) // Recursively calculate subgroup height
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
  _nested = false,
  isAddingNewRowAllowed?: boolean,
): { startIndex: number; endIndex: number; startGroupYOffset: number } {
  let currentOffset = GROUP_PADDING
  let startIndex = 0
  let endIndex = groupCount - 1
  let previousOffset = currentOffset

  for (let i = 0; i < groupCount; i++) {
    const group = groups.get(i)
    const groupHeight = calculateGroupHeight(group, rowHeight, isAddingNewRowAllowed)
    if (currentOffset + groupHeight >= scrollTop) {
      startIndex = i
      // startGroupYOffset - is the offset of the group from the top of the viewport, this could be negative
      // when the group is partially visible at the top of the viewport
      // excluding column header height from the calculation since it will be sticky on top
      const startGroupYOffset = COLUMN_HEADER_HEIGHT_IN_PX - (scrollTop - currentOffset)

      // todo: verify - GROUP_HEADER_HEIGHT + GROUP_PADDING addition
      // it's added to render one extra group at the bottom of the viewport to avoid empty space
      const viewportBottom = scrollTop + viewportHeight + GROUP_HEADER_HEIGHT + GROUP_PADDING
      for (let j = i; j < groupCount; j++) {
        const endGroup = groups.get(j)

        const endGroupHeight = calculateGroupHeight(endGroup, rowHeight, isAddingNewRowAllowed)
        if (currentOffset + endGroupHeight > viewportBottom) {
          endIndex = j
          break
        }
        currentOffset += endGroupHeight
        endIndex = j
      }

      return { startIndex, endIndex, startGroupYOffset }
    }

    previousOffset = currentOffset
    currentOffset += groupHeight
    startIndex = i + 1
  }

  const partialGroupHeight = scrollTop - previousOffset
  return { startIndex, endIndex, startGroupYOffset: partialGroupHeight }
}

export function generateGroupPath(data?: CanvasGroup) {
  if (!data) return []
  const path: Array<number> = []

  // Add groupIndex from each nestedIn entry
  if (data.nestedIn && data.nestedIn.length > 0) {
    data.nestedIn.forEach((nested) => path.push(nested.groupIndex!))
  }

  return path
}

export function calculateGroupRowTop(
  groups: Map<number, CanvasGroup>,
  path: number[],
  rowIndex: number,
  rowHeight: number,
  isAddingEmptyRowAllowed: boolean,
): number {
  let top = GROUP_PADDING
  let currentGroups = groups

  if (path.length === 0 || !path) {
    return rowIndex * rowHeight
  }

  for (let depth = 0; depth < path.length; depth++) {
    const groupIndex = path[depth]
    const group = currentGroups.get(groupIndex)
    if (!group) return top

    for (let i = 0; i < groupIndex; i++) {
      const siblingGroup = currentGroups.get(i)
      if (siblingGroup) {
        top += calculateGroupHeight(siblingGroup, rowHeight, isAddingEmptyRowAllowed)
      }
    }

    if (!group.isExpanded) {
      return top
    }

    top += GROUP_HEADER_HEIGHT

    if (group.path?.length && depth === path.length - 1) {
      // if (rowIndex >= 0 && rowIndex <= (group.count || 0)) {
      top += rowIndex * rowHeight + 1
      // }
      return top
    } else if (group.groups) {
      top += GROUP_EXPANDED_BOTTOM_PADDING
      currentGroups = group.groups
    } else {
      return top
    }
  }
  return top
}

export function findRowInGroups(groups: Map<number, CanvasGroup>, y: number, rowHeight: number): { row: number; path: number[] } {
  let currentOffset = 0
  const path: number[] = []

  function traverseGroups(currentGroups: Map<number, CanvasGroup>, targetY: number): { row: number; path: number[] } {
    for (const [groupIndex, group] of currentGroups) {
      if (!group) continue

      const groupHeaderHeight = GROUP_HEADER_HEIGHT + GROUP_PADDING
      const groupStart = currentOffset

      // Add group header height
      currentOffset += groupHeaderHeight

      if (group.isExpanded) {
        if (group.path) {
          // Leaf group with rows
          const rowCount = group.count
          const groupContentHeight = rowCount * rowHeight + 1 // Include border offset
          if (targetY >= groupStart && targetY < currentOffset + groupContentHeight) {
            // Target is within this group's rows
            const rowOffset = Math.floor((targetY - currentOffset) / rowHeight)
            return { row: rowOffset, path: [...path, groupIndex] }
          }
          currentOffset += groupContentHeight
        } else if (group.groups) {
          // Nested groups
          const subgroupStart = currentOffset
          path.push(groupIndex)
          const result = traverseGroups(group.groups, targetY)
          if (result.row !== -1) return result // Found in a subgroup
          path.pop()
          currentOffset = subgroupStart + group.groupCount * (GROUP_HEADER_HEIGHT + GROUP_PADDING)
        }
      }

      if (targetY < groupStart) {
        // Target is before this group
        return { row: -1, path: [] }
      }
    }

    // Target is beyond all groups
    return { row: -1, path: [] }
  }

  const result = traverseGroups(groups, y)
  return result.row === -1 ? { row: -1, path: [] } : result
}

export function findFirstExpandedGroupWithPath(groups: Map<number, CanvasGroup>): {
  group: CanvasGroup | null
  index: number
  path: number[]
} {
  function traverseGroups(
    currentGroups: Map<number, CanvasGroup>,
    currentPath: number[] = [],
  ): { group: CanvasGroup | null; index: number; path: number[] } {
    for (const [index, group] of currentGroups) {
      if (!group) continue

      // Check if group is expanded and has a path
      if (group.isExpanded && group.path) {
        return { group, index, path: [...currentPath, index] }
      }

      // If group has subgroups, recursively check them
      if (group.isExpanded && group.groups) {
        const subgroupResult = traverseGroups(group.groups, [...currentPath, index])
        if (subgroupResult.group !== null) {
          return subgroupResult
        }
      }
    }

    // No matching group found
    return { group: null, index: -1, path: [] }
  }

  return traverseGroups(groups)
}

export function findGroupByPath(groups: Map<number, CanvasGroup>, groupPath: number[]): CanvasGroup | null {
  if (!groupPath || groupPath.length === 0) {
    return null
  }

  let currentGroups = groups
  let targetGroup: CanvasGroup | null = null

  for (let depth = 0; depth < groupPath.length; depth++) {
    const groupIndex = groupPath[depth]
    targetGroup = currentGroups.get(groupIndex)

    if (!targetGroup) {
      return null
    }

    if (depth === groupPath.length - 1) {
      return targetGroup
    }

    if (!targetGroup.isExpanded || !targetGroup.groups) {
      return null
    }

    currentGroups = targetGroup.groups
  }

  return targetGroup
}

export function isGroupExpanded(groups: Map<number, CanvasGroup>, groupPath: number[]): boolean {
  const group = findGroupByPath(groups, groupPath)
  return !!group?.isExpanded
}

export function getDefaultGroupData(group?: CanvasGroup) {
  if (!group) return {}
  return group.nestedIn.reduce((acc, curr) => {
    if (
      curr.key !== '__nc_null__' &&
      // avoid setting default value for rollup, formula, barcode, qrcode, links, ltar
      !isLinksOrLTAR(curr.column_uidt) &&
      ![UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.Barcode, UITypes.QrCode].includes(curr.column_uidt)
    ) {
      acc[curr.title] = curr.key

      if (curr.column_uidt === UITypes.Checkbox) {
        acc[curr.title] =
          acc[curr.title] === GROUP_BY_VARS.TRUE ? true : acc[curr.title] === GROUP_BY_VARS.FALSE ? false : !!acc[curr.title]
      }
    }
    return acc
  }, {} as Record<string, any>)
}
