// Height + layout math for calendar week-view record cards.
//
// Week-view cards show multiple fields stacked over several lines instead of a
// single truncated line. Each card is its OWN natural height (no stretching),
// and cards pack tightly down each day column. Multi-day bars (which occupy
// several columns at one logical row) sit below whatever is already placed in
// every column they span, so they never overlap and stay aligned across the
// columns they cover.

// Height of a single-field card: one 20px line + 8px vertical padding + 2px
// border. Each extra field adds a 20px line plus the 2px inter-field gap, so the
// card always fully contains its fields (no half-cut last line).
export const CALENDAR_CARD_BASE_HEIGHT = 30

/** Extra height per additional visible field (line + inter-field gap). */
export const CALENDAR_CARD_FIELD_HEIGHT = 22

/** Max fields a card grows to show before clipping (+ click-to-expand). */
export const CALENDAR_CARD_MAX_FIELDS = 5

/** Vertical gap between stacked cards in the all-day week view. */
export const CALENDAR_CARD_ROW_GAP = 8

/**
 * Natural card height for a given number of non-empty visible fields.
 * Always shows at least one line; capped at CALENDAR_CARD_MAX_FIELDS.
 *
 * count=1 → 30px, 2 → 52px, 3 → 74px, 5 (cap) → 118px.
 */
export function cardHeightForFieldCount(count: number): number {
  const fields = Math.max(1, Math.min(Math.floor(count) || 1, CALENDAR_CARD_MAX_FIELDS))
  return CALENDAR_CARD_BASE_HEIGHT + (fields - 1) * CALENDAR_CARD_FIELD_HEIGHT
}

export interface CalendarLayoutItem {
  /** Index of the first day column the record occupies. */
  startCol: number
  /** Number of day columns the record spans (1 for single-day records). */
  spanCols: number
  /** Stacking order within a column (from findFirstSuitableRow). */
  rowIndex: number
  /** The record's natural card height. */
  height: number
}

/**
 * Pack cards down each day column using their natural heights.
 *
 * Processes records in stacking order (rowIndex ascending) and greedily places
 * each one just below the lowest occupied point across all the columns it spans.
 * Returns a `tops` array parallel to `items` (px from the top of the grid).
 *
 * - Single-day records → each column packs tightly with no wasted space.
 * - Multi-day bars → placed below everything already in their spanned columns,
 *   so they never overlap and share one consistent top across those columns.
 */
export function computeColumnPackedLayout(items: CalendarLayoutItem[], gap: number = CALENDAR_CARD_ROW_GAP): number[] {
  const order = items.map((item, index) => ({ ...item, index })).sort((a, b) => a.rowIndex - b.rowIndex)

  const columnBottom: Record<number, number> = {}
  const tops: number[] = new Array(items.length)

  for (const item of order) {
    let top = gap
    for (let c = item.startCol; c < item.startCol + item.spanCols; c++) {
      top = Math.max(top, columnBottom[c] ?? gap)
    }
    tops[item.index] = top
    const bottom = top + item.height + gap
    for (let c = item.startCol; c < item.startCol + item.spanCols; c++) {
      columnBottom[c] = bottom
    }
  }

  return tops
}
