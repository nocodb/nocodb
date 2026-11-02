import dayjs from 'dayjs'
import { legacyCmdNlParse, withMeta } from './adapters'
import { cmdNlAssumptionsOf } from './assumptions'
import type { ChartTerm } from './chart'
import { parseChart } from './chart'
import { tokenizeCmdNl } from './extract'
import { CMD_NL_GRAMMAR, buildCmdNlLattice } from './grammar'
import type { CmdNlHistoryEntry } from './history'
import { applyCmdNlHistory } from './history'
import type { CmdIR, CmdNlTag, Span } from './ir'
import { buildCmdNlLexicon, cmdNlLiteralGuard } from './lexicon'
import type { CmdNlCtx } from './procedural'
import { parseCmdNlProcedural, readingKey } from './procedural'
import type { CmdNlSchema } from './schema'
import { validateIR } from './validate'
import type { CmdNlTagger } from './taggerScore'
import { analyzeCmdNlTagger, cmdNlTaggerDisagrees, getCmdNlTagger, rescoreWithCmdNlTagger } from './taggerScore'

/**
 * The Cmd+K NL parser: a weighted chart grammar (grammar.ts) gives the n-best readings; the stage-2
 * readers and the legacy parsers add contenders; agreement between them lifts a reading. The top
 * reading is flagged unsure when it is weak, contested or partial.
 */

export interface CmdNlParseOptions {
  now?: dayjs.Dayjs
  /** Loaded rows, for value anchors ("austin deals"). */
  rows?: Record<string, unknown>[]
  /** Skip the legacy parsers (edits, fills, creates, calc). */
  legacy?: boolean
  /** The stage-2 readers: contenders next to the chart (default), left out, or used alone. */
  procedural?: 'fallback' | 'off' | 'only'
  /** Readings kept per chart node. */
  k?: number
  /** The learned tagger: a loaded model, `null` for off; by default the one the palette loaded, if any. */
  tagger?: CmdNlTagger | null
  /**
   * Stage-2 and legacy readings: `uncovered` keeps them only for intents the chart didn't read (they still
   * lift agreeing chart readings); `all` keeps every one as a rival.
   */
  rivals?: 'uncovered' | 'all'
  /** Readings the user picked before (history.ts): a capped boost for the same masked query, applied last. */
  history?: CmdNlHistoryEntry[]
}

/**
 * The top reading is unsure below `score`, under `coverage`, or with a rival within `margin` — wider
 * (`intentMargin`) when the rival does something else ("qty at most 100": filter, or cap the value).
 */
export const CMD_NL_UNSURE = { score: 0.5, margin: 0.05, intentMargin: 0.12, coverage: 0.8 }

/** Stage-2 and legacy readings rank just under an equal chart reading. */
const PROCEDURAL_FACTOR = 0.97
const LEGACY_SCORE = 0.9
const LEGACY_SCORE_CONTESTED = 0.75
/** Edits, fills and creates are on the grammar now; a legacy-only one ("last week" as a shift) is a fallback. */
const LEGACY_SCORE_GRAMMAR_INTENT = 0.7
const GRAMMAR_INTENTS = new Set(['edit', 'fill', 'create'])
/** A chart reading another parser also produced. */
const AGREEMENT = 1.04

/** Default for `rivals`; see CmdNlParseOptions. */
export const CMD_NL_RIVALS: 'uncovered' | 'all' = 'uncovered'

/** Whether a tagger the palette loaded is used by default. */
export const CMD_NL_TAGGER_ENABLED = true

type Body = Omit<CmdIR, 'meta'>

function contextFor(query: string, schema: CmdNlSchema, opts: CmdNlParseOptions, onUnanchored?: () => void): CmdNlCtx {
  const lex = buildCmdNlLexicon(schema, opts.rows)
  return {
    tokens: tokenizeCmdNl(query, cmdNlLiteralGuard(lex, onUnanchored)),
    lex,
    schema,
    now: opts.now ?? dayjs(),
    rows: opts.rows,
  }
}

/** The shorthand reading of a value literal no field claimed ("500+" as "500 or more") ranks below the option. */
const LITERAL_ALTERNATIVE = 0.9

function runChart(ctx: CmdNlCtx, k: number) {
  const lattice = buildCmdNlLattice(ctx)
  return parseChart(CMD_NL_GRAMMAR, 'S', ctx.tokens.length, lattice.edges, ctx, { k, skippable: lattice.skippable })
}

/** Terminal categories as span tags; verbs and edit words are `verb`, the rest of what they read `other`. */
const TAG_OF: Record<string, CmdNlTag> = {
  FIELD: 'field',
  OPT: 'value',
  MEMBER: 'value',
  ME: 'value',
  MY: 'value',
  POSS: 'value',
  BOOL: 'value',
  QUOTED: 'value',
  TEXTW: 'value',
  TAGOPT: 'value',
  STATE: 'value',
  UNF: 'value',
  NUM: 'num',
  PCT: 'num',
  SIGNED: 'num',
  XMUL: 'num',
  DATE: 'date',
  WINDOW: 'date',
  WDAY: 'date',
  EDGE: 'date',
  OVERDUE: 'date',
  DUR: 'duration',
  SIGNDUR: 'duration',
  PTS: 'unit',
  CMP: 'cmp',
  TRAIL: 'cmp',
  NEG: 'neg',
  NEGW: 'neg',
  AND: 'conj',
  OR: 'conj',
  COMMA: 'conj',
  AGG: 'agg',
  DAGG: 'agg',
  // grammarExtra: assumptions, implied fields, ratios and comparisons.
  VAGUE: 'value',
  NUMF: 'num',
  AGE: 'duration',
  RATIOW: 'agg',
  RPAIR: 'value',
  RTO: 'conj',
  VS: 'conj',
  COMPAREV: 'verb',
  CLAUSEW: 'filler',
}

/** A query ending on a connector or a comparator still waiting for its value. */
const DANGLING_END = /(?:^|\s)(?:where|with|whose|and|or|of|by|than|is|is not|isn't|in|not in|=|!=|<|>|<=|>=)$/i

/** Which characters of the query each part of a reading came from, for chips. */
function spansOf(ctx: CmdNlCtx, terms: ChartTerm[]): Span[] {
  return terms.map((term) => {
    const v = term.value as { fieldId?: string; value?: unknown; member?: string } | null
    const ref =
      v && typeof v === 'object' ? v.fieldId ?? v.member ?? (typeof v.value === 'string' ? v.value : undefined) : undefined
    return {
      start: ctx.tokens[term.start]!.start,
      end: ctx.tokens[term.end - 1]!.end,
      tag: TAG_OF[term.cat] ?? (/V$|^CREATEV$|^FILLOP$/.test(term.cat) ? 'verb' : 'other'),
      ...(ref ? { ref } : {}),
    }
  })
}

/** The chart grammar's valid readings of `query`, best first. */
export function parseCmdNlChart(query: string, schema: CmdNlSchema, opts: CmdNlParseOptions = {}): CmdIR[] {
  const text = query.trim()
  if (!text) return []
  let unanchored = false
  const ctx = contextFor(text, schema, opts, () => (unanchored = true))
  if (!ctx.tokens.length) return []
  const read = (c: CmdNlCtx, factor: number) =>
    runChart(c, opts.k ?? 5)
      .readings.map((r) => {
        const assumptions = cmdNlAssumptionsOf(r.value as Body, r.terms, c.tokens, schema)
        return withMeta(r.value as Body, schema, {
          score: r.score * factor,
          coverage: 1,
          spans: spansOf(c, r.terms),
          source: 'grammar',
          ...(assumptions.length ? { assumptions } : {}),
        })
      })
      .filter((ir) => validateIR(ir, schema).ok)
  const readings = read(ctx, 1)
  if (!unanchored) return readings
  const seen = new Set(readings.map(readingKey))
  const plain = { ...ctx, tokens: tokenizeCmdNl(text) }
  return [...readings, ...read(plain, LITERAL_ALTERNATIVE).filter((ir) => !seen.has(readingKey(ir)))]
}

/** Terminal categories the grammar expects after `prefix` (FIELD, CMP, Val…), for autocomplete. */
export function cmdNlExpected(prefix: string, schema: CmdNlSchema, opts: CmdNlParseOptions = {}): Set<string> {
  const ctx = contextFor(prefix.trim(), schema, opts)
  return runChart(ctx, 1).expected
}

/**
 * Every reading of `query` against `schema`, best first. Readings that don't explain the whole query
 * are dropped (the palette then offers the AI fallback); `meta.unsure` marks a top reading to confirm.
 */
export function parseCmdNl(query: string, schema: CmdNlSchema, opts: CmdNlParseOptions = {}): CmdIR[] {
  const text = query.trim()
  if (!text) return []
  // Mid-typing ("count where company size is"): the clause isn't written yet, so don't read around it.
  if (DANGLING_END.test(text)) return []
  const mode = opts.procedural ?? 'fallback'

  const chart = mode === 'only' ? [] : parseCmdNlChart(text, schema, opts)
  const stage2 =
    mode === 'off'
      ? []
      : parseCmdNlProcedural(text, schema, { now: opts.now, rows: opts.rows, legacy: false }).map((ir) => ({
          ...ir,
          meta: { ...ir.meta, score: ir.meta.score * (mode === 'only' ? 1 : PROCEDURAL_FACTOR) },
        }))
  // A legacy reading contested by a full grammar reading of the same intent ranks just under it.
  const bestByIntent = new Map<string, number>()
  for (const ir of [...chart, ...stage2]) bestByIntent.set(ir.intent, Math.max(bestByIntent.get(ir.intent) ?? 0, ir.meta.score))
  const legacy =
    opts.legacy === false
      ? []
      : legacyCmdNlParse(text, schema, { now: opts.now }).map((ir) => {
          const rival = bestByIntent.get(ir.intent)
          const alone = GRAMMAR_INTENTS.has(ir.intent) ? LEGACY_SCORE_GRAMMAR_INTENT : LEGACY_SCORE
          const score = rival === undefined ? alone : Math.min(LEGACY_SCORE_CONTESTED, rival * PROCEDURAL_FACTOR)
          return { ...ir, meta: { ...ir.meta, score } }
        })

  // Agreement: a chart reading the stage-2 readers or a legacy parser also produced.
  const others = new Set([...stage2, ...legacy].map(readingKey))
  const lifted = chart.map((ir) =>
    others.has(readingKey(ir)) ? { ...ir, meta: { ...ir.meta, score: Math.min(1, ir.meta.score * AGREEMENT) } } : ir,
  )

  // Once the chart reads an intent, other parsers' versions of it only lift agreement, not compete.
  const chartIntents = new Set(chart.map((ir) => ir.intent))
  const keep = (ir: CmdIR) => (opts.rivals ?? CMD_NL_RIVALS) === 'all' || !chartIntents.has(ir.intent)

  // Chart readings first, so they win ties.
  const best = new Map<string, CmdIR>()
  for (const ir of [...lifted, ...stage2.filter(keep), ...legacy.filter(keep)]) {
    const key = readingKey(ir)
    const prev = best.get(key)
    if (!prev || ir.meta.score > prev.meta.score) best.set(key, ir)
  }
  let ranked = [...best.values()].sort((a, b) => b.meta.score - a.meta.score)

  const tagger = opts.tagger === null ? undefined : opts.tagger ?? (CMD_NL_TAGGER_ENABLED ? getCmdNlTagger() : undefined)
  if (!tagger || !ranked.length) return applyCmdNlHistory(flagUnsure(ranked, false, text), opts.history, text)
  const analysis = analyzeCmdNlTagger(tagger, text, schema)
  ranked = rescoreWithCmdNlTagger(ranked, tagger, analysis)
  return applyCmdNlHistory(flagUnsure(ranked, cmdNlTaggerDisagrees(ranked[0]!, tagger, analysis), text), opts.history, text)
}

const CHANGE_INTENTS = new Set(['edit', 'fill', 'create'])

/**
 * A change rival with no verb ("price >= 300" as a cap, "give me …" as an assign) doesn't put a read
 * in doubt; a literal "=" ("priority = 5") still does, since setting is a plausible intent there.
 */
function isWeakRival(top: CmdIR, rival: CmdIR, text: string) {
  // An explicit signed amount ("qty -5", "price +10%") asks for a change, not a match.
  if (CHANGE_INTENTS.has(top.intent) && rival.intent === 'filter') return /(^|\s)[+-]\d/.test(text)
  if (CHANGE_INTENTS.has(top.intent) || !CHANGE_INTENTS.has(rival.intent)) return false
  // A request opener ("give me …", "pull up …") isn't an assign.
  if (/^\s*(give me|gimme|pull up|show me|get me|find me)\b/i.test(text)) return true
  if (/(^|[^<>!=])=($|[^=])/.test(text)) return false
  // "qty at most 100" may mean cap it; "qty <= 100" only ever filters.
  if (/\b(at most|at least|up to|no more than|no less than|cap|limit)\b/i.test(text)) return false
  return !rival.meta.spans.some((span) => span.tag === 'verb')
}

/** Marks the top reading unsure when it is weak, a near tie, partial or disputed; counts its close rivals. */
export function flagUnsure(ranked: CmdIR[], disputed = false, text = ''): CmdIR[] {
  const [top, ...rest] = ranked
  if (!top) return ranked
  const rivals = rest.filter(
    (ir) =>
      ir.meta.score >= top.meta.score - (ir.intent === top.intent ? CMD_NL_UNSURE.margin : CMD_NL_UNSURE.intentMargin) &&
      !isWeakRival(top, ir, text),
  ).length
  const unsure = disputed || top.meta.score < CMD_NL_UNSURE.score || rivals > 0 || top.meta.coverage < CMD_NL_UNSURE.coverage
  return [{ ...top, meta: { ...top.meta, unsure, alternatives: rivals } }, ...rest]
}
