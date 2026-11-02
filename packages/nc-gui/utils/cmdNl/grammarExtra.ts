import { ChartScaled } from './chart'
import { numberAt } from './extract'
import type { CmdNlAssumption, CmdNlCmp, Cond, CondLeaf, Scalar } from './ir'
import { CMD_NL_RATIO, cmdNlPercentileText, isCondLeaf } from './ir'
import { cmdNlLexAt } from './lexicon'
import type { CmdNlCtx } from './procedural'
import { fieldsOf, leafOf, numberField, pickField, systemField } from './procedural'
import type { CmdNlField } from './schema'
import { cmdNlField } from './schema'
import type { Body, FieldT, R } from './grammarCore'
import { F, fieldT, isDateKind, r, ref } from './grammarCore'
import { DATE_UNITS } from './vocab/dates'
import { singular } from './vocab/inflect'
import { NUMBER_FIELD_HINTS } from './vocab/hints'

/**
 * Readings that rest on a guess the palette shows as an editable chip: vague words ("recent", "big
 * deals", "high priority"), a stat with no summary word, a threshold with no field. Plus ratios
 * between two conditions ("won to lost") and side-by-side comparisons ("won vs lost").
 */

type Add = (cat: string, start: number, end: number, value?: unknown, score?: number) => void

/** What an assumption-bearing terminal carries; parse.ts turns `assume` into meta.assumptions. */
export interface AssumeT {
  text: string
  kind: CmdNlAssumption['kind']
  ref?: string
}

interface VagueT {
  cond: Cond
  assume: AssumeT
}

/** A number whose field comes from a cue ("4 stars", "$500") or is implied ("500 or more"). */
interface NumFieldT {
  t: 'num'
  value: number
  fieldId: string
  assume: AssumeT
}

/** "<n> <unit> old": an age in days, measured on the table's created-like date field. */
interface AgeT {
  days: number
  assume: AssumeT
}

/* ----------------------------------------------------------------------------- vocabularies */

const RECENT_WORDS = new Set(['recent', 'recently', 'lately', 'fresh'])
const OLD_WORDS = new Set(['old', 'older', 'aged'])
const STALE_WORDS = new Set(['stale', 'dormant', 'inactive-ish', 'untouched', 'neglected'])
const SOON_WORDS = new Set(['soon', 'upcoming', 'imminent'])
const BIG_WORDS = new Set(['big', 'large', 'huge', 'major', 'sizable', 'sizeable', 'high-value', 'highvalue', 'whale'])
const URGENT_WORDS = new Set(['urgent', 'asap', 'critical', 'emergency'])
const HIGH_WORDS = new Set(['high', 'higher', 'top'])
const LOW_WORDS = new Set(['low', 'lower', 'minor'])
const STAR_WORDS = new Set(['star', 'stars', 'rating'])
const CURRENCY_WORDS = new Set(['usd', 'eur', 'gbp', 'inr', 'dollar', 'dollars', 'bucks', 'euro', 'euros', 'pounds', 'rupees'])
const RATIO_WORDS = new Set(['ratio', 'ratios'])
const VS_WORDS = new Set(['vs', 'versus', 'v.', 'against'])
const COMPARE_WORDS = new Set(['compare', 'comparing', 'comparison'])
const CLAUSE_WORDS = new Set(['where', 'for', 'with', 'whose', 'in', 'of', 'from', 'among', 'across'])

/** What each vague word measures with, for explaining why it found nothing (diagnose.ts). */
export const CMD_NL_VAGUE_NEEDS: Record<string, string> = Object.fromEntries([
  ...[...RECENT_WORDS, ...OLD_WORDS].map((w) => [w, 'a date field']),
  ...[...STALE_WORDS].map((w) => [w, 'a last-updated date field']),
  ...[...SOON_WORDS].map((w) => [w, 'a due or close date field']),
  ...[...BIG_WORDS].map((w) => [w, 'a number field']),
  ...[...URGENT_WORDS].map((w) => [w, 'a priority field']),
])

const RECENT_DAYS = 30
const OLD_DAYS = 90
const SOON_DAYS = 14
const LOW_STOCK = 10
/** Percentile a vague size word means ("big deals": the top quarter). */
const BIG_PERCENTILE = 0.75
/** Priority levels on a number field with no scale. */
const PRIORITY_PERCENTILE: Record<'urgent' | 'high' | 'low', ['gte' | 'lte', number]> = {
  urgent: ['gte', 0.9],
  high: ['gte', 0.75],
  low: ['lte', 0.25],
}

const CREATED_HINTS = ['created', 'added', 'opened', 'submitted', 'joined', 'start', 'updated', 'modified', 'date']
const AGE_HINTS = ['created', 'added', 'opened', 'submitted', 'joined', 'registered']
const STALE_HINTS = ['updated', 'modified', 'edited', 'activity', 'contacted', 'touched', 'last']
const SOON_HINTS = ['due', 'deadline', 'close', 'end', 'expiry', 'expires', 'renewal', 'restock', 'start', 'date']
const PRIORITY_TITLE = /prio|priority|severity|urgency|importance/
const QTY_TITLE = /qty|quantity|stock|inventory|units|on hand|available/
const RATING_TITLE = /rating|stars|score|priority|prio/
const PERCENT_TITLE = /prob|percent|pct|rate|chance|likelihood|%/
const HIGH_OPTION = /high|urgent|critical|highest|top|p0|p1|blocker|severe|major/i
const LOW_OPTION = /low|minor|trivial|lowest|p3|p4/i

/* ---------------------------------------------------------------------------------- helpers */

/** A field whose title matches `hints` among `fields`, never falling back to the first. */
function hintedOnly(fields: CmdNlField[], hints: string[]): CmdNlField | undefined {
  const picked = pickField(fields, hints)
  if (!picked) return
  const words = picked.title.toLowerCase().split(/\s+/)
  return hints.some((h) => words.some((w) => w.startsWith(h))) ? picked : undefined
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

const dateFields = (ctx: CmdNlCtx) => fieldsOf(ctx, ['date', 'datetime'])

/** When a record was added: a user's created-like date, else the hidden Created time, else any date. */
function createdField(ctx: CmdNlCtx) {
  const user = dateFields(ctx).filter((f) => !f.system)
  return hintedOnly(user, AGE_HINTS) ?? systemField(ctx, 'CreatedTime') ?? pickField(user, CREATED_HINTS)
}

/** When a record last changed: a user's updated-like date, else the hidden Last modified time. */
function modifiedField(ctx: CmdNlCtx) {
  const user = dateFields(ctx).filter((f) => !f.system)
  return hintedOnly(user, STALE_HINTS) ?? systemField(ctx, 'LastModifiedTime')
}

const CREATED_WORDS = new Set(['added', 'created', 'new', 'joined', 'submitted'])
const MODIFIED_WORDS = new Set(['updated', 'modified', 'changed', 'edited', 'touched'])

function vague(
  field: CmdNlField,
  cmp: CmdNlCmp,
  value: Scalar | Scalar[] | undefined,
  text: string,
  kind: AssumeT['kind'],
): VagueT {
  return { cond: leafOf(field, cmp, value, 'implicit'), assume: { text, kind, ref: field.id } }
}

/** "high priority", "urgent": the priority-like field's top (or bottom) values. */
function priorityCond(ctx: CmdNlCtx, level: 'urgent' | 'high' | 'low', field?: CmdNlField): VagueT | undefined {
  const target =
    field ?? ctx.schema.fields.find((f) => PRIORITY_TITLE.test(f.title.toLowerCase()) && ['select', 'number'].includes(f.kind))
  if (!target) return
  if (target.kind === 'select') {
    const re = level === 'low' ? LOW_OPTION : HIGH_OPTION
    const options = (target.options ?? []).filter((o) => re.test(o))
    if (!options.length) return
    const value = options.length === 1 ? options[0]! : options
    return vague(target, options.length === 1 ? 'eq' : 'anyof', value, `${target.title} is ${options.join(' or ')}`, 'priority')
  }
  if (target.kind !== 'number') return
  // Without a scale (a Rating's max), a level is a share of the records, resolved on the server.
  const max = target.max
  if (!max) {
    const [cmp, p] = PRIORITY_PERCENTILE[level]
    return vague(target, cmp, { percentile: p }, `${target.title} in the ${cmdNlPercentileText(cmp, p)}`, 'priority')
  }
  if (level === 'low') return vague(target, 'lte', 2, `${target.title} at most 2`, 'priority')
  const bound = level === 'urgent' ? max : max - 1
  return vague(target, 'gte', bound, `${target.title} at least ${fmt(bound)}`, 'priority')
}

/** Number fields a cue points at, best first: unit-typed ones (Rating, Currency, Percent), then by title. */
function cuedFields(ctx: CmdNlCtx, cue: 'rating' | 'currency' | 'percent'): CmdNlField[] {
  const numbers = fieldsOf(ctx, ['number'])
  const uidt = { rating: 'Rating', currency: 'Currency', percent: 'Percent' }[cue]
  const typed = numbers.filter((f) => f.uidt === uidt)
  if (typed.length) return typed
  const title =
    cue === 'rating' ? RATING_TITLE : cue === 'percent' ? PERCENT_TITLE : /amount|price|revenue|value|cost|budget|total/
  return numbers.filter((f) => title.test(f.title.toLowerCase()))
}

/* --------------------------------------------------------------------------------- lattice */

export function addExtraTerminals(ctx: CmdNlCtx, words: string[], add: Add) {
  const { tokens, lex, schema } = ctx
  const isFieldAt = (i: number, test: (f: CmdNlField) => boolean) =>
    cmdNlLexAt(lex, words, i, ['field'])
      .map((m) => ({ end: m.end, field: cmdNlField(schema, m.entry.fieldId) }))
      .find((m) => m.field && test(m.field))
  const hasValueAt = (i: number) => cmdNlLexAt(lex, words, i, ['value', 'member']).some((m) => m.end === i + 1)

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    const next = words[i + 1] ?? ''
    const isNoun = (word: string) => lex.tableNouns.has(word)

    // B) vague words, each with the guess it makes.
    if (!hasValueAt(i)) {
      if (RECENT_WORDS.has(w) || (w === 'new' && isNoun(next) && singular(next) !== next)) {
        // "recently updated" measures on the modified field, "recently added" (and plain "recent") on created.
        const modified = MODIFIED_WORDS.has(next)
        const field = modified ? modifiedField(ctx) : createdField(ctx)
        if (field) {
          const value: Scalar = { relative: 'pastNumberOfDays', n: RECENT_DAYS }
          const assume = vague(field, 'within', value, `${field.title} in the past ${RECENT_DAYS} days`, 'date-window')
          add('VAGUE', i, i + 1, assume, 0.85)
          if (modified || CREATED_WORDS.has(next)) add('VAGUE', i, i + 2, assume, 0.9)
        }
      }
      if (OLD_WORDS.has(w) && numberAt(tokens, i - 2) === undefined) {
        const field = createdField(ctx)
        if (field) {
          const value: Scalar = { relative: 'daysAgo', n: OLD_DAYS }
          add('VAGUE', i, i + 1, vague(field, 'lt', value, `${field.title} more than ${OLD_DAYS} days ago`, 'date-window'), 0.85)
        }
      }
      // "stale" means not touched lately: only a last-updated style field says that.
      if (STALE_WORDS.has(w)) {
        const field = modifiedField(ctx)
        if (field) {
          const value: Scalar = { relative: 'daysAgo', n: OLD_DAYS }
          add('VAGUE', i, i + 1, vague(field, 'lt', value, `${field.title} more than ${OLD_DAYS} days ago`, 'date-window'), 0.85)
        }
      }
      // "not updated in 30 days", "untouched for 2 weeks": last changed before that many days ago.
      const notChanged = (w === 'not' && MODIFIED_WORDS.has(next)) || w === 'untouched'
      if (notChanged) {
        const at = w === 'not' ? i + 2 : i + 1
        const skip = ['in', 'for', 'since', 'over'].includes(words[at] ?? '') ? at + 1 : at
        const n = numberAt(tokens, skip)
        const unit = n ? DATE_UNITS[words[n.end] ?? ''] : undefined
        const field = modifiedField(ctx)
        if (n && unit && field && unit[0] !== 'minute' && unit[0] !== 'hour') {
          const days = Math.round(n.value * { minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365 }[unit[0]] * unit[1])
          const value: Scalar = { relative: 'daysAgo', n: days }
          const text = `${field.title} more than ${days} days ago`
          if (days > 0) add('VAGUE', i, n.end + 1, vague(field, 'lt', value, text, 'date-window'), 0.9)
        }
      }
      if (SOON_WORDS.has(w) || (w === 'coming' && next === 'up')) {
        const field = pickField(
          dateFields(ctx).filter((f) => !f.system && !/created|added|updated|modified/.test(f.title.toLowerCase())),
          SOON_HINTS,
        )
        if (field) {
          const value: Scalar = { relative: 'nextNumberOfDays', n: SOON_DAYS }
          const end = w === 'coming' ? i + 2 : i + 1
          add('VAGUE', i, end, vague(field, 'within', value, `${field.title} in the next ${SOON_DAYS} days`, 'date-window'), 0.85)
        }
      }
      const bigPair = w === 'high' && next === 'value'
      const top = w === 'top' && isNoun(next) && numberAt(tokens, i + 1) === undefined
      if (BIG_WORDS.has(w) || bigPair || top) {
        const field = numberField(ctx)
        if (field) {
          const text = `${field.title} in the ${cmdNlPercentileText('gte', BIG_PERCENTILE)}`
          const value: Scalar = { percentile: BIG_PERCENTILE }
          add('VAGUE', i, bigPair ? i + 2 : i + 1, vague(field, 'gte', value, text, 'threshold'), 0.85)
        }
      }
      if (URGENT_WORDS.has(w)) {
        const p = priorityCond(ctx, 'urgent')
        if (p) add('VAGUE', i, i + 1, p, 0.85)
      }
    }

    // "high priority", "low prio", "top priority": the level word and the field together.
    if (HIGH_WORDS.has(w) || LOW_WORDS.has(w)) {
      const prio = isFieldAt(i + 1, (f) => PRIORITY_TITLE.test(f.title.toLowerCase()))
      const p = prio ? priorityCond(ctx, LOW_WORDS.has(w) ? 'low' : 'high', prio.field) : undefined
      if (prio && p) add('VAGUE', i, prio.end, p, 0.9)
    }
    // "low stock", "running low", "low on stock"
    const qtyAt = (j: number) => isFieldAt(j, (f) => f.kind === 'number' && QTY_TITLE.test(f.title.toLowerCase()))
    const qtyField = fieldsOf(ctx, ['number']).find((f) => QTY_TITLE.test(f.title.toLowerCase()))
    if (w === 'low' && qtyField) {
      const after = qtyAt(i + 1) ?? (next === 'on' ? qtyAt(i + 2) : undefined)
      if (after?.field) {
        const text = `${after.field.title} at most ${LOW_STOCK}`
        add('VAGUE', i, after.end, vague(after.field, 'lte', LOW_STOCK, text, 'threshold'), 0.9)
      }
    }
    if (w === 'running' && next === 'low' && qtyField) {
      add('VAGUE', i, i + 2, vague(qtyField, 'lte', LOW_STOCK, `${qtyField.title} at most ${LOW_STOCK}`, 'threshold'), 0.9)
    }

    // E) numbers with a unit that names the field: "4 stars", "$500", "50%".
    const num = numberAt(tokens, i)
    if (num && !tokens[i]!.text.startsWith('+')) {
      const unitWord = words[num.end] ?? ''
      const raw = tokens
        .slice(i, num.end)
        .map((t) => t.text)
        .join('')
      const cue: 'rating' | 'currency' | 'percent' | undefined = STAR_WORDS.has(unitWord)
        ? 'rating'
        : /[$€£₹¥]/.test(raw) || CURRENCY_WORDS.has(unitWord)
        ? 'currency'
        : num.percent
        ? 'percent'
        : undefined
      const end = cue === 'rating' || CURRENCY_WORDS.has(unitWord) ? num.end + 1 : num.end
      const cued = cue ? cuedFields(ctx, cue) : []
      // A cue names the field; failing one, every number field is a candidate, the hinted one first.
      const candidates = cued.length ? cued : cue === 'rating' ? [] : fieldsOf(ctx, ['number'])
      const hinted = cued.length ? cued[0] : numberField(ctx)
      const named = !!hintedOnly(candidates, NUMBER_FIELD_HINTS) || !!cued.length
      for (const field of candidates) {
        const score = !named || candidates.length === 1 ? 0.9 : field === hinted ? 1 : 0.85
        const value: NumFieldT = {
          t: 'num',
          value: num.value,
          fieldId: field.id,
          assume: { text: `${field.title}${cue === 'rating' ? ' (stars)' : ''}`, kind: 'field', ref: field.id },
        }
        add('NUMF', i, end, value, score)
      }

      // "under 2 weeks old", "older than 3 months": an age.
      // An age needs a created-like date; a due date's "2 weeks old" means nothing.
      const unit = DATE_UNITS[unitWord]
      const ageField = hintedOnly(dateFields(ctx), AGE_HINTS) ?? systemField(ctx, 'CreatedTime')
      if (unit && ageField && unitWord !== 'm' && OLD_WORDS.has(words[num.end + 1] ?? '')) {
        const days = Math.round(num.value * { minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365 }[unit[0]] * unit[1])
        const assume: AssumeT = { text: `Age by ${ageField.title}`, kind: 'date-window', ref: ageField.id }
        if (days > 0) add('AGE', i, num.end + 2, { days, assume } satisfies AgeT, 0.85)
      }
    }

    // D) ratios and comparisons
    if (RATIO_WORDS.has(w)) add('RATIOW', i, i + 1)
    if (w === 'to' || w === ':') add('RTO', i, i + 1)
    if (VS_WORDS.has(w)) add('VS', i, i + 1)
    if (w === 'compared' && (next === 'to' || next === 'with')) add('VS', i, i + 2)
    if (COMPARE_WORDS.has(w)) add('COMPAREV', i, i + 1)
    // "won:lost": one token naming two values.
    const pair = /^([^:]+):([^:]+)$/.exec(tokens[i]!.text.toLowerCase())
    if (pair) {
      const side = (text: string) =>
        cmdNlLexAt(lex, [text], 0, ['value']).find((m) => m.end === 1 && cmdNlField(schema, m.entry.fieldId)?.kind === 'select')
      const a = side(pair[1]!)
      const b = side(pair[2]!)
      if (a && b && a.entry.fieldId === b.entry.fieldId && a.entry.value !== b.entry.value) {
        const field = cmdNlField(schema, a.entry.fieldId)!
        add('RPAIR', i, i + 1, {
          num: leafOf(field, 'eq', a.entry.value!, 'value'),
          den: leafOf(field, 'eq', b.entry.value!, 'value'),
        })
      }
    }

    // C) a clause word after a field: "revenue where …", "amount for …", "qty of …".
    if (CLAUSE_WORDS.has(w)) add('CLAUSEW', i, i + 1, w)
  }
}

/* ----------------------------------------------------------------------------------- rules */

const cond = (k: unknown) => k as Cond

/** Implied summary of `field` when no summary word was typed: sum (avg for percents/ratings), else counts. */
function impliedStat(ctx: CmdNlCtx, f: FieldT, where: Cond, clause: string): Body | ChartScaled | undefined {
  const field = F(ctx, f)
  if (!field) return
  if (field.kind === 'number') {
    const fn = field.uidt === 'Percent' || field.uidt === 'Rating' ? 'avg' : 'sum'
    if (!field.aggregations.includes(fn)) return
    const body: Body = { intent: 'stat', scope: 'where', where, aggs: [{ fn, field: ref(f.fieldId, f.via) }] }
    return new ChartScaled(body, 0.85)
  }
  // "status where project is web": counted per value, and only after an explicit "where".
  if (clause !== 'where' && clause !== 'whose') return
  if (field.kind === 'select' || field.kind === 'multiselect' || field.kind === 'user') {
    const body: Body = { intent: 'stat', scope: 'where', where, aggs: [{ fn: 'count' }], groupBy: [ref(f.fieldId, f.via)] }
    return new ChartScaled(body, 0.45)
  }
  if (!field.aggregations.includes('count_filled')) return
  const body: Body = { intent: 'stat', scope: 'where', where, aggs: [{ fn: 'count_filled', field: ref(f.fieldId, f.via) }] }
  return new ChartScaled(body, 0.45)
}

/** A one-value condition on a select-like field: "won", "stage is lost". */
function singleValueLeaf(c: Cond): CondLeaf | undefined {
  if (!isCondLeaf(c) || (c.cmp !== 'eq' && c.cmp !== 'anyof')) return
  const values = Array.isArray(c.value) ? c.value : [c.value]
  return values.length === 1 && typeof values[0] === 'string' ? c : undefined
}

const sameFieldPair = (a: Cond, b: Cond) => {
  const x = singleValueLeaf(a)
  const y = singleValueLeaf(b)
  return x && y && x.field.id === y.field.id && JSON.stringify(x.value) !== JSON.stringify(y.value) ? [x, y] : undefined
}

function ratioBody(ctx: CmdNlCtx, num: Cond, den: Cond, target?: FieldT, where?: Cond): Body | undefined {
  if (JSON.stringify(num) === JSON.stringify(den)) return
  const field = target ? F(ctx, target) : undefined
  if (target && (field?.kind !== 'number' || !field.aggregations.includes('sum'))) return
  return {
    intent: 'stat',
    scope: where ? 'where' : 'view',
    where,
    aggs: [
      target
        ? { fn: CMD_NL_RATIO, base: 'sum', field: ref(target.fieldId, target.via), num, den }
        : { fn: CMD_NL_RATIO, base: 'count', num, den },
    ],
  }
}

/**
 * "won vs lost", "compare revenue of tech vs retail": each side's figure side by side (grouped by the
 * field both values belong to); the ratio is the alternative reading.
 */
function compareBody(ctx: CmdNlCtx, a: Cond, b: Cond, target?: FieldT): Body | undefined {
  const pair = sameFieldPair(a, b)
  if (!pair) return
  const field = target ? F(ctx, target) : undefined
  if (target && (field?.kind !== 'number' || !field.aggregations.includes('sum'))) return
  const groupField = cmdNlField(ctx.schema, pair[0].field.id)
  if (!groupField || !['select', 'multiselect', 'user'].includes(groupField.kind)) return
  return {
    intent: 'stat',
    scope: 'where',
    where: { op: 'or', args: pair.map((l) => ({ ...l, cmp: l.cmp === 'anyof' ? 'anyof' : 'eq' })) },
    aggs: [target ? { fn: 'sum', field: ref(target.fieldId, target.via) } : { fn: 'count' }],
    groupBy: [ref(groupField.id, 'implicit')],
  }
}

const RATIO_ALT = 0.9

/** "under 2 weeks old" → created in the past 14 days; "older than 3 months" → before 90 days ago. */
function ageCond(ctx: CmdNlCtx, cmp: CmdNlCmp, age: AgeT): VagueT | undefined {
  const field = age.assume.ref ? cmdNlField(ctx.schema, age.assume.ref) : undefined
  if (!field) return
  if (cmp === 'lt' || cmp === 'lte') {
    const value: Scalar = { relative: 'pastNumberOfDays', n: age.days }
    return vague(field, 'within', value, `${field.title} in the past ${age.days} days`, 'date-window')
  }
  if (cmp === 'gt' || cmp === 'gte') {
    const value: Scalar = { relative: 'daysAgo', n: age.days }
    return vague(field, 'lt', value, `${field.title} more than ${age.days} days ago`, 'date-window')
  }
}

function numFieldCond(ctx: CmdNlCtx, cmp: CmdNlCmp, v: NumFieldT): Cond | undefined {
  const field = cmdNlField(ctx.schema, v.fieldId)
  if (!field || !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(cmp)) return
  return leafOf(field, cmp, v.value, 'implicit')
}

export const EXTRA_RULES: R[] = [
  // B) vague words become ordinary conditions, so they combine like any other.
  r('Cond', 'VAGUE', 1, (k) => (k[0] as VagueT).cond),
  // "closing soon", "due recently": the window on the date field the user named.
  r('Cond', 'FIELD VAGUE', 1, (k, ctx) => {
    const v = k[1] as VagueT
    const field = F(ctx, fieldT(k[0]))
    if (v.assume.kind !== 'date-window' || !field || !isDateKind(field) || !isCondLeaf(v.cond)) return
    return { ...v.cond, field: ref(field.id, fieldT(k[0]).via) }
  }),
  // "recently updated", "lately created": the vague window on the date field named after it.
  r('Cond', 'VAGUE FIELD', 1, (k, ctx) => {
    const v = k[0] as VagueT
    const field = F(ctx, fieldT(k[1]))
    if (v.assume.kind !== 'date-window' || !field || !isDateKind(field) || !isCondLeaf(v.cond)) return
    return { ...v.cond, field: ref(field.id, fieldT(k[1]).via) }
  }),
  r('Cond', 'CMP AGE', 1, (k, ctx) => ageCond(ctx, k[0] as CmdNlCmp, k[1] as AgeT)?.cond),

  // E) bare thresholds: "500 or more", "at least 4 stars", "over $10k".
  r('Cond', 'CMP NUMF', 0.88, (k, ctx) => numFieldCond(ctx, k[0] as CmdNlCmp, k[1] as NumFieldT)),
  r('Cond', 'NUMF TRAIL', 0.88, (k, ctx) => numFieldCond(ctx, k[1] as CmdNlCmp, k[0] as NumFieldT)),
  r('Cond', 'NUMF', 0.7, (k, ctx) => {
    const v = k[0] as NumFieldT
    const field = cmdNlField(ctx.schema, v.fieldId)
    // Only a unit-named number stands alone ("4 stars"); a bare "500" says nothing.
    return field && v.assume.text.endsWith('(stars)') ? leafOf(field, 'eq', v.value, 'implicit') : undefined
  }),

  // C) stats with no summary word: "revenue where industry is tech", "amount for won deals".
  r('Stat', 'FIELD CLAUSEW Expr', 1, (k, ctx) => impliedStat(ctx, fieldT(k[0]), cond(k[2]), k[1] as string)),

  // D) ratios: "ratio of won to lost deals", "won:lost", "ratio of revenue of tech to retail".
  r('Stat', 'RATIOW Atom RTO Atom', 1, (k, ctx) => ratioBody(ctx, cond(k[1]), cond(k[3]))),
  r('Stat', 'RATIOW Atom RTO Atom Expr', 0.97, (k, ctx) => ratioBody(ctx, cond(k[1]), cond(k[3]), undefined, cond(k[4]))),
  r('Stat', 'RATIOW FIELD Atom RTO Atom', 1, (k, ctx) => ratioBody(ctx, cond(k[2]), cond(k[4]), fieldT(k[1]))),
  r('Stat', 'RPAIR', 1, (k, ctx) => {
    const v = k[0] as { num: Cond; den: Cond }
    return ratioBody(ctx, v.num, v.den)
  }),
  r('Stat', 'RATIOW RPAIR', 1, (k, ctx) => {
    const v = k[1] as { num: Cond; den: Cond }
    return ratioBody(ctx, v.num, v.den)
  }),
  r('Stat', 'FIELD RPAIR', 1, (k, ctx) => {
    const v = k[1] as { num: Cond; den: Cond }
    return ratioBody(ctx, v.num, v.den, fieldT(k[0]))
  }),
  // Comparisons: side by side first, the ratio as the alternative.
  r('Stat', 'Atom VS Atom', 1, (k, ctx) => compareBody(ctx, cond(k[0]), cond(k[2]))),
  r('Stat', 'Atom VS Atom AGG', 1, (k, ctx) => (k[3] === 'count' ? compareBody(ctx, cond(k[0]), cond(k[2])) : undefined)),
  r('Stat', 'COMPAREV Atom VS Atom', 1, (k, ctx) => compareBody(ctx, cond(k[1]), cond(k[3]))),
  r('Stat', 'COMPAREV FIELD Atom VS Atom', 1, (k, ctx) => compareBody(ctx, cond(k[2]), cond(k[4]), fieldT(k[1]))),
  r('Stat', 'Atom VS Atom', 0.97, (k, ctx) => {
    const body = sameFieldPair(cond(k[0]), cond(k[2])) ? ratioBody(ctx, cond(k[0]), cond(k[2])) : undefined
    return body ? new ChartScaled(body, RATIO_ALT) : undefined
  }),
  r('Stat', 'Atom VS Atom AGG', 1, (k, ctx) => {
    const body = k[3] === 'count' && sameFieldPair(cond(k[0]), cond(k[2])) ? ratioBody(ctx, cond(k[0]), cond(k[2])) : undefined
    return body ? new ChartScaled(body, RATIO_ALT) : undefined
  }),
  r('Stat', 'COMPAREV FIELD Atom VS Atom', 1, (k, ctx) => {
    const body = ratioBody(ctx, cond(k[2]), cond(k[4]), fieldT(k[1]))
    return body ? new ChartScaled(body, RATIO_ALT) : undefined
  }),
  r('Stat', 'COMPAREV Atom VS Atom', 1, (k, ctx) => {
    const body = ratioBody(ctx, cond(k[1]), cond(k[3]))
    return body ? new ChartScaled(body, RATIO_ALT) : undefined
  }),
]
