import type { CmdFill, CmdRelativeEdit } from '../commandPaletteRelativeEdit'

/**
 * The one typed reading of a Cmd+K query. Grammar, adapters over the legacy parsers and the LLM
 * fallback all produce it; validateIR checks it and compile turns it into NocoDB filters.
 */

export type CmdNlKind = 'number' | 'date' | 'datetime' | 'checkbox' | 'select' | 'multiselect' | 'user' | 'text' | 'other'

export interface FieldRef {
  id: string
  /** How the field was found: its title, a synonym, one of its values ("won deals"), a typo, or implied. */
  via: 'title' | 'synonym' | 'value' | 'fuzzy' | 'implicit'
}

/** NocoDB's own date sub-operators, so relative dates compile without translation. */
export type CmdNlRelativeDate =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'oneWeekAgo'
  | 'oneWeekFromNow'
  | 'oneMonthAgo'
  | 'oneMonthFromNow'
  | 'daysAgo'
  | 'daysFromNow'
  | 'pastWeek'
  | 'pastMonth'
  | 'pastYear'
  | 'nextWeek'
  | 'nextMonth'
  | 'nextYear'
  | 'pastNumberOfDays'
  | 'nextNumberOfDays'

export type Scalar =
  | string
  | number
  | boolean
  | null
  | { date: string; precision: 'day' | 'minute' }
  | { range: [string, string] }
  | { relative: CmdNlRelativeDate; n?: number }
  | { member: string }
  | { me: true }

export type CmdNlCmp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'nlike'
  | 'blank'
  | 'notblank'
  | 'checked'
  | 'notchecked'
  | 'anyof'
  | 'allof'
  | 'nanyof'
  | 'between'
  | 'within'

export interface CondLeaf {
  field: FieldRef
  cmp: CmdNlCmp
  value?: Scalar | Scalar[]
}

export type Cond = { op: 'and' | 'or'; args: Cond[] } | { op: 'not'; arg: Cond } | CondLeaf

/**
 * `fn` is the footer's aggregation id (getAvailableAggregations): sum, avg, count_unique, earliest_date…,
 * or CMD_NL_SHARE for a share of the total (see CmdIR.where for what the share is of).
 */
export interface Agg {
  fn: string
  field?: FieldRef
  /** fn 'share' / 'ratio' only: the figure compared, the sum of `field` or the record count (no field). */
  base?: 'sum' | 'count'
  /** fn 'ratio' only: base(view ∧ where ∧ num) ÷ base(view ∧ where ∧ den). */
  num?: Cond
  den?: Cond
}

/**
 * Share of total, as a percentage. Without groupBy: base(view ∧ where) ÷ base(view) × 100, so `where` is
 * the share's condition, not a scope. With groupBy (no where): each group's base ÷ base(view) × 100.
 */
export const CMD_NL_SHARE = 'share'

/** Ratio between two conditions ("won to lost deals"); `where`, if any, scopes both sides. */
export const CMD_NL_RATIO = 'ratio'

/**
 * A guess made on the user's behalf ("recent" → in the past 30 days, no summary word → sum), so the
 * palette can show it as an editable chip. `span` is the UTF-16 range of the words it came from.
 */
export interface CmdNlAssumption {
  span: [number, number]
  /** Readable: "Close date in the past 30 days", "Sum of Amount". */
  text: string
  kind: 'date-window' | 'threshold' | 'priority' | 'agg' | 'field'
  /** The field the assumption is about. */
  ref?: string
}

/**
 * Tagged, unlike the design sketch: CmdRelativeEdit and CmdFill both use `kind`
 * ('number', 'date', 'text'), so a bare union of them can't be told apart.
 */
export type CmdNlEditOp =
  | { kind: 'relative'; edit: CmdRelativeEdit }
  | { kind: 'set'; value: Scalar | Scalar[] }
  | { kind: 'clear' }
  | { kind: 'fill'; fill: CmdFill }

export interface CmdNlEdit {
  /** Absent when the edit targets "the active field" of whatever surface runs it. */
  field?: FieldRef
  op: CmdNlEditOp
}

/** Token categories; shared with the trained tagger (tools/cmdk-tagger), so keep them stable. */
export type CmdNlTag =
  | 'field'
  | 'value'
  | 'cmp'
  | 'agg'
  | 'verb'
  | 'num'
  | 'date'
  | 'duration'
  | 'unit'
  | 'conj'
  | 'neg'
  | 'filler'
  | 'other'

export interface Span {
  /** UTF-16 offsets into the query. */
  start: number
  end: number
  tag: CmdNlTag
  /** Field id, option title, member id… what the span was linked to. */
  ref?: string
  score?: number
}

export type CmdNlIntent = 'filter' | 'stat' | 'edit' | 'fill' | 'create' | 'sort' | 'group' | 'calc' | 'navigate'

export interface CmdIR {
  intent: CmdNlIntent
  /** What the edit or stat applies to: the current selection, the whole view, or a where clause in the view. */
  scope: 'selection' | 'view' | 'where'
  where?: Cond
  aggs?: Agg[]
  groupBy?: FieldRef[]
  orderBy?: { field: FieldRef | 'agg0'; dir: 'asc' | 'desc' }[]
  limit?: number
  edits?: CmdNlEdit[]
  /** Insert payload keyed by field id. */
  create?: { values: Record<string, Scalar | Scalar[]> }
  calc?: { expression: string; value: number }
  meta: {
    /** 0–1; below the palette's threshold the reading shows as "unsure". */
    score: number
    /** Share of the query's characters the reading accounts for, 0–1. */
    coverage: number
    spans: Span[]
    canonical: string
    source: 'grammar' | 'llm' | 'history'
    /** Set on the top reading when it should be confirmed: weak score, a near tie, or partial coverage. */
    unsure?: boolean
    /** How many other readings scored within the unsure margin of this one. */
    alternatives?: number
    /** Guesses the reading rests on (vague words, an implied summary); empty or absent when it has none. */
    assumptions?: CmdNlAssumption[]
  }
}

export function isCondLeaf(cond: Cond): cond is CondLeaf {
  return 'cmp' in cond
}

/** Every leaf of a condition tree, left to right. */
export function condLeaves(cond: Cond | undefined): CondLeaf[] {
  if (!cond) return []
  if (isCondLeaf(cond)) return [cond]
  if (cond.op === 'not') return condLeaves(cond.arg)
  return cond.args.flatMap(condLeaves)
}

/** `and` of the given conditions, flattened; undefined for none. */
export function andConds(conds: Cond[]): Cond | undefined {
  if (!conds.length) return
  if (conds.length === 1) return conds[0]
  return { op: 'and', args: conds.flatMap((c) => (!isCondLeaf(c) && c.op === 'and' ? c.args : [c])) }
}
