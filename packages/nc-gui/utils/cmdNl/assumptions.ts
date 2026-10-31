import type { ChartTerm } from './chart'
import type { CmdNlToken } from './extract'
import type { CmdIR, CmdNlAssumption } from './ir'
import { CMD_NL_RATIO, CMD_NL_SHARE } from './ir'
import type { CmdNlSchema } from './schema'
import { cmdNlField } from './schema'

/** Terminals that say which summary a stat is; a stat without one has an implied summary. */
const SUMMARY_TERMS = new Set(['AGG', 'DAGG', 'SHARE', 'PAGG', 'RATIOW', 'RPAIR', 'VS', 'COMPAREV'])

const AGG_LABEL: Record<string, string> = { sum: 'Sum', avg: 'Average', count: 'Count', count_filled: 'Filled count' }

/**
 * The guesses a chart reading rests on: terminals that carry `assume` (vague words, a field implied
 * by a unit or by nothing), and a stat summary nobody typed ("revenue where …" → Sum of revenue).
 */
export function cmdNlAssumptionsOf(
  ir: Omit<CmdIR, 'meta'>,
  terms: ChartTerm[],
  tokens: CmdNlToken[],
  schema: CmdNlSchema,
): CmdNlAssumption[] {
  const span = (t: ChartTerm): [number, number] => [tokens[t.start]!.start, tokens[t.end - 1]!.end]
  const out: CmdNlAssumption[] = []
  for (const term of terms) {
    const v = term.value as { assume?: Omit<CmdNlAssumption, 'span'> } | null
    if (v && typeof v === 'object' && v.assume) out.push({ span: span(term), ...v.assume })
  }

  const agg = ir.aggs?.[0]
  if (ir.intent === 'stat' && agg && agg.fn !== CMD_NL_SHARE && agg.fn !== CMD_NL_RATIO) {
    // "deals per stage" plainly counts; only a summary of a field's values is a guess.
    const plainCount = agg.fn === 'count' && terms.some((t) => t.cat === 'PER')
    if (!plainCount && !terms.some((t) => SUMMARY_TERMS.has(t.cat))) {
      const fieldTerm = terms.find((t) => t.cat === 'FIELD') ?? terms[0]
      const field = agg.field ? cmdNlField(schema, agg.field.id) : undefined
      const grouped = ir.groupBy?.length ? cmdNlField(schema, ir.groupBy[0]!.id) : undefined
      const label = AGG_LABEL[agg.fn] ?? agg.fn
      const text = field ? `${label} of ${field.title}` : grouped ? `${label} by ${grouped.title}` : label
      if (fieldTerm) out.push({ span: span(fieldTerm), text, kind: 'agg', ref: field?.id ?? grouped?.id })
    }
  }
  return out
}
