import type { CanvasGroup } from '~/lib/types'

const groupIdentity = (group: CanvasGroup) => group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_')

const groupPath = (group: CanvasGroup) => group.nestedIn.map((n) => n.groupIndex!)

/**
 * After the loaded group chunks of one level were refetched into `groupMap`, put back each
 * group that kept its index and value, with the fresh counts, so its expanded state, sub-groups
 * and loaded rows stay. A collapsed kept group drops its sub-groups so expanding refetches them.
 *
 * Returns the paths whose rows are stale (group changed, went away or is collapsed), and the
 * expanded kept groups, to refresh their rows or recurse into their sub-groups.
 */
export function mergeRefetchedGroups({
  groupsBefore,
  groupMap,
  total,
  isLeafLevel,
}: {
  groupsBefore: Map<number, CanvasGroup>
  groupMap: Map<number, CanvasGroup>
  total: number
  isLeafLevel: boolean
}): { stalePaths: Array<Array<number>>; expandedKept: CanvasGroup[] } {
  const stalePaths: Array<Array<number>> = []
  const expandedKept: CanvasGroup[] = []

  for (const [index, before] of groupsBefore) {
    // Before the identity check: a refetch writes only the indices it returns, so a group past
    // the new total is still the same object.
    if (index >= total) {
      groupMap.delete(index)
      stalePaths.push(groupPath(before))
      continue
    }

    const after = groupMap.get(index)
    // Outside the refetched chunks.
    if (after === before) continue

    if (!after || groupIdentity(after) !== groupIdentity(before)) {
      stalePaths.push(groupPath(before))
      continue
    }

    if (before.count !== after.count) before.aggregationState = undefined
    before.count = after.count
    before.groupCount = after.groupCount
    groupMap.set(index, before)

    if (before.isExpanded) {
      expandedKept.push(before)
      continue
    }

    if (!isLeafLevel) {
      before.groups = new Map()
      before.chunkStates = []
    }
    stalePaths.push(groupPath(before))
  }

  return { stalePaths, expandedKept }
}
