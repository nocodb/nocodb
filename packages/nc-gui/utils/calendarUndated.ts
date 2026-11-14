interface UndatedRange {
  fk_from_col: { title?: string }
  fk_to_col?: { title?: string } | null
}

const hasValue = (v: unknown) => v !== null && v !== undefined && v !== ''

// Single range keeps its original rule (an end-date range also counts a missing end as undated).
// With several ranges a record is undated only when every range column is empty.
export function isRecordUndated(row: Record<string, any>, ranges: UndatedRange[]): boolean {
  if (!ranges.length) return false

  if (ranges.length === 1) {
    const { fk_from_col: from, fk_to_col: to } = ranges[0]
    const hasFrom = hasValue(row[from.title!])
    return to ? !hasFrom || !hasValue(row[to.title!]) : !hasFrom
  }

  return ranges.every(({ fk_from_col: from, fk_to_col: to }) => !hasValue(row[from.title!]) && !(to && hasValue(row[to.title!])))
}
