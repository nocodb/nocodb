interface RangeLike {
  fk_from_col: { id?: string; title?: string }
  fk_to_col?: { id?: string; title?: string } | null
}

const hasValue = (v: unknown) => v !== null && v !== undefined && v !== ''

const rangeSuffix = (range: RangeLike) => `-${range.fk_from_col.id ?? range.fk_from_col.title}`

// Unique per card so the same record shown in two ranges never shares a key or drag id.
// Idempotent: a suffix added by an earlier pass (e.g. after a drop) is not stacked.
export function getCalendarCardKey(id: string | number, range: RangeLike, ranges: RangeLike[]): string {
  if (ranges.length < 2) return `${id}`

  let base = `${id}`
  const suffixes = ranges.map(rangeSuffix)
  for (let stripped = true; stripped; ) {
    const suffix = suffixes.find((s) => base.length > s.length && base.endsWith(s))
    stripped = !!suffix
    if (suffix) base = base.slice(0, -suffix.length)
  }
  return `${base}${rangeSuffix(range)}`
}

// First range in which the record has a date; falls back to the first range.
export function getRecordOwnRange<T extends RangeLike>(row: Record<string, any>, ranges: T[]): T | undefined {
  return (
    ranges.find(({ fk_from_col: from, fk_to_col: to }) => hasValue(row[from.title!]) || (!!to && hasValue(row[to.title!]))) ??
    ranges[0]
  )
}
