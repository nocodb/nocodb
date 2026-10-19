import type { CanvasGroup } from '~/lib/types'

const groupIdentity = (group: CanvasGroup) => group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_')

const groupPath = (group: CanvasGroup) => group.nestedIn.map((n) => n.groupIndex!)

/**
 * After the loaded group chunks of one level were refetched into `groupMap`, put back each
 * group that kept its index and value, so its expanded state, sub-groups and loaded rows stay.
 * A collapsed kept group drops its sub-groups so expanding refetches them.
 *
 * Returns the paths whose rows are stale (group changed, went away or is collapsed), the
 * expanded kept groups, to refresh their rows or recurse into their sub-groups, and the kept
 * groups' fresh row counts. Those are not applied here: the caller applies them with the
 * refetched rows, or the header would show the new count over the old rows meanwhile.
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
}): {
  stalePaths: Array<Array<number>>
  expandedKept: CanvasGroup[]
  countUpdates: Array<{ group: CanvasGroup; count: number }>
} {
  const stalePaths: Array<Array<number>> = []
  const expandedKept: CanvasGroup[] = []
  const countUpdates: Array<{ group: CanvasGroup; count: number }> = []

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

    // Refetched because rows moved: the same count can hide a row that left and one that joined.
    before.aggregationState = undefined
    if (before.count !== after.count) countUpdates.push({ group: before, count: after.count })
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

  return { stalePaths, expandedKept, countUpdates }
}

/**
 * Whether the grid renders from these caches. A chunk being fetched (`loading`) counts: a refresh
 * in flight marks its chunk so, and a second refresh then must queue rather than fall back to the
 * full reload, which is only for renderers that never use the caches (paginated table, legacy
 * group-by).
 */
export function isGridCacheInUse(chunkStates: Array<string | undefined>): boolean {
  return chunkStates.some((state) => state === 'loaded' || state === 'loading')
}
