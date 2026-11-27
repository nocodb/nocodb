import type { Group } from '~/lib/types'

/** Grid `canReorderWithinGroup` terms: row order is data, so a locked view doesn't block it. */
export function isGalleryReorderAllowed(p: {
  canEditData: boolean
  isSqlView: boolean
  isPublic: boolean
  isReadonly: boolean
  hasOrderColumn: boolean
  hasSorts: boolean
  hasPk: boolean
  isMobileMode: boolean
  isInterface: boolean
}) {
  return (
    p.canEditData &&
    !p.isSqlView &&
    !p.isPublic &&
    !p.isReadonly &&
    p.hasOrderColumn &&
    !p.hasSorts &&
    p.hasPk &&
    !p.isMobileMode &&
    !p.isInterface
  )
}

/**
 * The `dataMove` target for dropping card `from` at insertion slot `slot` (0..count) of an ordered list.
 * `before` is the pk of the card it lands in front of, or null for the end of the list, which is only
 * sent when the list is fully loaded. Undefined when the drop changes nothing or can't be placed.
 */
export function resolveGalleryCardDrop(
  pks: Array<string | null | undefined>,
  from: number,
  slot: number,
  isFullyLoaded: boolean,
): { before: string | null } | undefined {
  if (from < 0 || from >= pks.length || slot < 0 || slot > pks.length) return
  if (slot === from || slot === from + 1) return

  if (slot === pks.length) return isFullyLoaded ? { before: null } : undefined

  const before = pks[slot]
  return before ? { before } : undefined
}

/** Drop scope of a grouped card: cards move only within their own group. */
export function galleryGroupScope(group?: Group) {
  return group ? `group:${JSON.stringify(group.nestedIn.map((n) => [n.column_name, n.key]))}` : 'flat'
}
