import type { CmdIR, Cond } from './ir'
import { condLeaves, isCondLeaf } from './ir'
import type { CmdNlSchema } from './schema'
import { cmdNlField } from './schema'

/**
 * Telemetry for the natural-language path, kept structural: intents, aggregation and comparator names,
 * field types, counts and flags. Nothing typed, no field titles or ids, no values — see the privacy test.
 */
export interface CmdNlReadingTele {
  intent: CmdIR['intent']
  /** 0 = the top reading. */
  rank: number
  scope: CmdIR['scope']
  unsure: boolean
  assumed: boolean
  assumption_kinds: string[]
  source: CmdIR['meta']['source']
  aggs: string[]
  cmps: string[]
  /** Field types involved (deduped), e.g. "SingleSelect", "Currency". */
  uidts: string[]
  conditions: number
  has_or: boolean
  has_not: boolean
  edit_kinds: string[]
  group_by: number
  sort: number
}

function hasOp(cond: Cond | undefined, op: 'or' | 'not'): boolean {
  if (!cond || isCondLeaf(cond)) return false
  if (cond.op === op) return true
  return cond.op === 'not' ? hasOp(cond.arg, op) : cond.args.some((arg) => hasOp(arg, op))
}

const unique = <T>(list: T[]) => [...new Set(list)]

export function cmdNlReadingTele(ir: CmdIR, schema: CmdNlSchema, rank: number): CmdNlReadingTele {
  const ratioConds = (ir.aggs ?? []).flatMap((a) => [a.num, a.den]).filter((c): c is Cond => !!c)
  const leaves = [...condLeaves(ir.where), ...ratioConds.flatMap((c) => condLeaves(c))]
  const fieldIds = [
    ...leaves.map((l) => l.field.id),
    ...(ir.aggs ?? []).flatMap((a) => (a.field ? [a.field.id] : [])),
    ...(ir.groupBy ?? []).map((g) => g.id),
    ...(ir.orderBy ?? []).flatMap((o) => (o.field === 'agg0' ? [] : [o.field.id])),
    ...(ir.edits ?? []).flatMap((e) => (e.field ? [e.field.id] : [])),
    ...Object.keys(ir.create?.values ?? {}),
  ]
  const assumptions = ir.meta.assumptions ?? []
  return {
    intent: ir.intent,
    rank,
    scope: ir.scope,
    unsure: !!ir.meta.unsure,
    assumed: assumptions.length > 0,
    assumption_kinds: unique(assumptions.map((a) => a.kind)),
    source: ir.meta.source,
    aggs: unique((ir.aggs ?? []).map((a) => a.fn)),
    cmps: unique(leaves.map((l) => l.cmp)),
    uidts: unique(fieldIds.map((id) => cmdNlField(schema, id)?.uidt ?? 'unknown')),
    conditions: leaves.length,
    has_or: hasOp(ir.where, 'or') || ratioConds.some((c) => hasOp(c, 'or')),
    has_not: hasOp(ir.where, 'not') || leaves.some((l) => l.cmp.startsWith('n')),
    edit_kinds: unique((ir.edits ?? []).map((e) => (e.op.kind === 'relative' ? `relative:${e.op.edit.kind}` : e.op.kind))),
    group_by: ir.groupBy?.length ?? 0,
    sort: ir.orderBy?.length ?? 0,
  }
}

/** Parse time per keystroke, bucketed. */
export function cmdNlLatencyBucket(ms: number) {
  if (ms < 1) return '<1'
  if (ms < 5) return '<5'
  if (ms < 16) return '<16'
  if (ms < 50) return '<50'
  return '>=50'
}

/** How many records a "…where…" edit touched, bucketed. */
export function cmdNlCountBucket(count: number) {
  if (count <= 1) return '1'
  if (count <= 10) return '2-10'
  if (count <= 100) return '11-100'
  return '101-1000'
}
