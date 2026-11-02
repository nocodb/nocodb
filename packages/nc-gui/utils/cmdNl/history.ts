import type { CmdIR } from './ir'
import { condLeaves } from './ir'

/**
 * Learning from what the user picked: a masked query ("sum of revenue where industry is #") remembers the
 * reading the user chose for it (intent, fields, aggregation, comparator). Similar queries rank that reading
 * a little higher. Local, per user and table; never more than a near-tie breaker.
 */

export interface CmdNlHistoryEntry {
  /** The query with numbers and quoted text masked (cmdNlPattern). */
  pattern: string
  /** The chosen reading's shape (cmdNlTemplate). */
  template: string
  /** The query as typed, shown again as a recent query. */
  query: string
  count: number
  at: number
}

/**
 * Boost per remembered pick, and its cap. It only applies when the parser itself is unsure, and the cap
 * matches the unsure intent margin (parse.ts CMD_NL_UNSURE): history settles a doubt, never a clear read.
 */
export const CMD_NL_HISTORY = { step: 0.05, cap: 0.15 }

/** "Sum of revenue where amount > 5,000" → "sum of revenue where amount > #": numbers and quotes masked. */
export function cmdNlPattern(text: string): string {
  return text
    .toLowerCase()
    .replace(/(["'“”‘’]).*?\1/g, '"…"')
    .replace(/[$€£₹]?\d[\d,.]*(?:k|m|bn|%)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

/** What a reading does, without its values: intent, aggregation, fields and comparators in order. */
export function cmdNlTemplate(ir: CmdIR): string {
  const parts: string[] = [ir.intent, ir.scope]
  for (const agg of ir.aggs ?? []) parts.push(`agg:${agg.fn}:${agg.base ?? ''}:${agg.field?.id ?? ''}`)
  for (const edit of ir.edits ?? []) parts.push(`edit:${edit.op.kind}:${edit.field?.id ?? ''}`)
  for (const g of ir.groupBy ?? []) parts.push(`group:${g.id}`)
  for (const o of ir.orderBy ?? []) parts.push(`order:${o.field === 'agg0' ? 'agg0' : o.field.id}:${o.dir}`)
  for (const leaf of condLeaves(ir.where)) parts.push(`where:${leaf.field.id}:${leaf.cmp}`)
  return parts.join('|')
}

/**
 * Re-ranks readings the user picked before for this pattern, only when the parser is unsure of its top one.
 * Deterministic and capped; the unsure flag is kept, so history reorders a doubt but never vouches for a guess.
 */
export function applyCmdNlHistory(ranked: CmdIR[], history: CmdNlHistoryEntry[] | undefined, text: string): CmdIR[] {
  if (!history?.length || ranked.length < 2 || !ranked[0]!.meta.unsure) return ranked
  const pattern = cmdNlPattern(text)
  const picks = new Map<string, number>()
  for (const entry of history)
    if (entry.pattern === pattern) picks.set(entry.template, (picks.get(entry.template) ?? 0) + entry.count)
  if (!picks.size) return ranked

  const top = ranked[0]!
  const boosted = ranked.map((ir, index) => {
    const count = picks.get(cmdNlTemplate(ir)) ?? 0
    const factor = 1 + Math.min(CMD_NL_HISTORY.cap, count * CMD_NL_HISTORY.step)
    return { ir, index, score: ir.meta.score * factor }
  })
  // Stable: equal scores keep the parser's order.
  boosted.sort((a, b) => b.score - a.score || a.index - b.index)
  if (boosted[0]!.ir === top) return ranked

  const [first, ...rest] = boosted.map((b) => b.ir)
  const { unsure, alternatives } = top.meta
  const clean = (ir: CmdIR): CmdIR => ({ ...ir, meta: { ...ir.meta, unsure: undefined, alternatives: undefined } })
  return [{ ...first!, meta: { ...first!.meta, unsure, alternatives } }, ...rest.map(clean)]
}
