import type { CmdIR, CmdNlTag } from './ir'
import type { CmdNlSchema } from './schema'
import type { CmdTaggerLexicon, CmdTaggerModelDoc, CmdTaggerResult } from './tagger'
import { buildCmdTaggerLexicon, cmdTaggerTokenOffsets, loadCmdTagger } from './tagger'

/**
 * The learned token tagger as a second opinion on chart readings: spans it agrees with gain, ones it
 * disagrees with lose, its intent head is a prior, and a clear disagreement marks the top reading unsure.
 * Optional and deterministic: parsing is unchanged when no model is loaded.
 */

export type CmdNlTagger = ReturnType<typeof loadCmdTagger>

export interface CmdNlTaggerAnalysis {
  result: CmdTaggerResult
  offsets: { start: number; end: number }[]
  /** Tag index per BIO family, for summing B- and I- probabilities. */
  family: Map<string, number[]>
}

/** The tagger is a second opinion on intent: a confident disagreement marks the top reading unsure. */
export const CMD_NL_TAGGER = {
  /** Exponent on mean span agreement, relative to `ref`. */
  spanWeight: 0.05,
  ref: 0.8,
  /** Intent prior: score × (1 − intentWeight + intentWeight × P(intent) / max P). */
  intentWeight: 0,
  /** The top reading is unsure when its spans agree less than this (0 = never). */
  unsureAgreement: 0,
  /** …or the tagger is this sure of another intent (> 1 = never). */
  unsureIntent: 0.8,
}

let loaded: CmdNlTagger | undefined
let loading: Promise<CmdNlTagger | undefined> | undefined

/** The model as a lazy chunk: imported the first time the palette asks, never in the main bundle. */
export function loadCmdNlTagger(): Promise<CmdNlTagger | undefined> {
  if (loaded) return Promise.resolve(loaded)
  loading ??= import('./model/cmdk-tagger.json')
    .then((mod) => {
      loaded = loadCmdTagger((mod as { default: CmdTaggerModelDoc }).default)
      return loaded
    })
    .catch(() => undefined)
  return loading
}

export function getCmdNlTagger() {
  return loaded
}

const lexicons = new WeakMap<CmdNlSchema, CmdTaggerLexicon>()

/** The tagger's lexicon features from the view: field titles, options, members, the table name. */
export function cmdNlTaggerLexicon(schema: CmdNlSchema): CmdTaggerLexicon {
  let lex = lexicons.get(schema)
  if (!lex) {
    lex = buildCmdTaggerLexicon({
      fields: schema.fields.map((f) => f.title),
      options: schema.fields.flatMap((f) => f.options ?? []),
      members: schema.fields.flatMap((f) => (f.members ?? []).flatMap((m) => [m.name, m.email ?? ''].filter(Boolean))),
      tables: [schema.table.title],
    })
    lexicons.set(schema, lex)
  }
  return lex
}

export function analyzeCmdNlTagger(tagger: CmdNlTagger, text: string, schema: CmdNlSchema): CmdNlTaggerAnalysis {
  const result = tagger.tag(text, cmdNlTaggerLexicon(schema))
  const family = new Map<string, number[]>()
  tagger.spec.tags.forEach((tag, i) => {
    const name = tag === 'O' ? 'O' : tag.slice(2)
    family.set(name, [...(family.get(name) ?? []), i])
  })
  return { result, offsets: cmdTaggerTokenOffsets(text), family }
}

/** Tagger families a span tag may be (the tagger is trained on the parser's own tags; near-misses count). */
const FAMILIES: Partial<Record<CmdNlTag, string[]>> = {
  field: ['FIELD'],
  value: ['VALUE'],
  num: ['NUM', 'VALUE'],
  date: ['DATE', 'DUR'],
  duration: ['DUR', 'DATE', 'NUM'],
  unit: ['UNIT', 'DUR'],
  cmp: ['CMP', 'NEG'],
  agg: ['AGG'],
  conj: ['CONJ'],
  neg: ['NEG', 'CMP'],
  verb: ['VERB'],
}

function familyProb(a: CmdNlTaggerAnalysis, token: number, families: string[]) {
  const probs = a.result.tagProbs[token]
  if (!probs) return undefined
  let best = 0
  for (const name of families) {
    let p = 0
    for (const i of a.family.get(name) ?? []) p += probs[i]!
    best = Math.max(best, p)
  }
  return best
}

/**
 * Mean of the tagger's belief in each span's role (floored, so one odd token can't sink a reading);
 * undefined when the reading has no spans to check.
 */
export function cmdNlSpanAgreement(ir: CmdIR, a: CmdNlTaggerAnalysis): number | undefined {
  let sum = 0
  let n = 0
  for (const span of ir.meta.spans) {
    const families = FAMILIES[span.tag]
    if (!families) continue
    const probs: number[] = []
    a.offsets.forEach((o, i) => {
      if (o.start < span.end && o.end > span.start) {
        const p = familyProb(a, i, families)
        if (p !== undefined) probs.push(p)
      }
    })
    if (!probs.length) continue
    sum += Math.max(0.1, probs.reduce((s, p) => s + p, 0) / probs.length)
    n++
  }
  return n ? sum / n : undefined
}

function intentProb(a: CmdNlTaggerAnalysis, tagger: CmdNlTagger, intent: string) {
  const i = tagger.spec.intents.indexOf(intent)
  return i < 0 ? undefined : a.result.intentProbs[i]
}

/** Rescales each reading's score by the tagger's agreement; returns readings re-sorted, best first. */
export function rescoreWithCmdNlTagger(ranked: CmdIR[], tagger: CmdNlTagger, a: CmdNlTaggerAnalysis): CmdIR[] {
  const maxIntent = Math.max(...a.result.intentProbs)
  return ranked
    .map((ir) => {
      let factor = 1
      const agreement = cmdNlSpanAgreement(ir, a)
      if (agreement !== undefined) factor *= Math.min(1.05, (agreement / CMD_NL_TAGGER.ref) ** CMD_NL_TAGGER.spanWeight)
      const p = intentProb(a, tagger, ir.intent)
      if (p !== undefined && maxIntent > 0)
        factor *= 1 - CMD_NL_TAGGER.intentWeight + (CMD_NL_TAGGER.intentWeight * p) / maxIntent
      return factor === 1 ? ir : { ...ir, meta: { ...ir.meta, score: Math.min(1, ir.meta.score * factor) } }
    })
    .sort((x, y) => y.meta.score - x.meta.score)
}

/** A clear tagger–grammar disagreement on the top reading: its spans or its intent. */
export function cmdNlTaggerDisagrees(top: CmdIR, tagger: CmdNlTagger, a: CmdNlTaggerAnalysis) {
  const agreement = cmdNlSpanAgreement(top, a)
  if (agreement !== undefined && agreement < CMD_NL_TAGGER.unsureAgreement) return true
  // An intent the model wasn't trained on (row colours) gets no intent opinion.
  if (!tagger.spec.intents.includes(top.intent)) return false
  const best = tagger.spec.intents[a.result.intentProbs.indexOf(Math.max(...a.result.intentProbs))]
  return best !== top.intent && Math.max(...a.result.intentProbs) >= CMD_NL_TAGGER.unsureIntent
}
