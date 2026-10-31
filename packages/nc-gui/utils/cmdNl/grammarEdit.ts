import type { CmdFill, CmdFillUnit, CmdRelativeEdit } from '../commandPaletteRelativeEdit'
import { resolveCmdFillDate } from '../commandPaletteRelativeEdit'
import { ChartScaled } from './chart'
import { numberAt } from './extract'
import type { CmdNlEdit, Cond, FieldRef, Scalar } from './ir'
import { cmdNlLexAt } from './lexicon'
import type { CmdNlCtx } from './procedural'
import { dateField, fieldsOf, pickField } from './procedural'
import type { CmdNlField } from './schema'
import { cmdNlField } from './schema'
import type { Body, FieldT, R, ValT } from './grammarCore'
import { F, fieldT, fitSet, r, ref, valT } from './grammarCore'
import type { CmdDateUnit } from './vocab/dates'
import { DATE_UNITS, WEEKDAY_NAMES } from './vocab/dates'
import { TEXT_CASE_OPS } from './vocab/verbs'
import { readCmdNumber } from './vocab/numbers'

/**
 * Edits ("add 10% to amount", "mark deals over 10k as won"), fills ("fill 1, 2, 3") and creates
 * ("new deal Acme 5000 won") for the chart grammar: their terminals and rules. The legacy apply
 * functions stay the executors; these rules only build the IR edits they run.
 */

type Add = (cat: string, start: number, end: number, value?: unknown, score?: number) => void

/* ------------------------------------------------------------------------------------- words */

const words = (...ws: string[]) => new Set(ws)

const SET_VERBS = words('set', 'mark', 'make', 'change', 'update', 'flag', 'put', 'switch', 'turn')
const AS_WORDS = words('as', 'to', '=', 'into')
const ASSIGN_VERBS = words('assign', 'reassign', 'allocate')
const UNASSIGN_VERBS = words('unassign', 'deassign')
const GIVE_VERBS = words('give', 'hand')
const TAKE_VERBS = words('take', 'claim', 'grab')
const SHIFT_VERBS = words('push', 'delay', 'postpone', 'defer', 'shift', 'bump', 'extend', 'move', 'reschedule', 'slip')
const ADD_VERBS = words('add', 'plus', 'increase', 'raise', 'bump', 'boost', 'inc', 'incr', 'increment', 'grow', 'up')
const SUB_VERBS = words('subtract', 'minus', 'decrease', 'reduce', 'lower', 'drop', 'cut', 'deduct', 'dec', 'decrement', 'shrink')
const MUL_VERBS = words('multiply', 'times', 'x', '×', '*')
const DIV_VERBS = words('divide')
const DOUBLE_VERBS: Record<string, number> = { double: 2, triple: 3, quadruple: 4, halve: 0.5 }
const BARE_NUMBER_OPS: Record<string, 'negate' | 'abs' | 'floor' | 'ceil'> = {
  negate: 'negate',
  abs: 'abs',
  floor: 'floor',
  ceil: 'ceil',
  ceiling: 'ceil',
}
const CAP_VERBS = words('cap', 'limit', 'clamp', 'max', 'maximum')
const MIN_VERBS = words('min', 'minimum')
const POINT_UNITS: Record<string, 'points' | 'stars'> = {
  point: 'points',
  points: 'points',
  pts: 'points',
  pt: 'points',
  pp: 'points',
  star: 'stars',
  stars: 'stars',
}
const MORE_WORDS = words('more', 'extra', 'higher')
const LESS_WORDS = words('less', 'fewer')
const LATER_WORDS = words('later', 'after', 'afterwards', 'out')
const EARLIER_WORDS = words('earlier', 'before', 'sooner', 'back', 'ago')
const APPEND_VERBS = words('append', 'suffix')
const PREPEND_VERBS = words('prepend', 'prefix')
const REPLACE_VERBS = words('replace', 'substitute')
const REMOVE_VERBS = words('remove', 'strip')
const CHECK_VERBS = words('check', 'tick')
const UNCHECK_VERBS = words('uncheck', 'untick', 'unmark')
const TOGGLE_VERBS = words('toggle', 'flip')
const TAG_VERBS = words('tag', 'label')
const COPULAS = words('is', 'are', 'was', 'were', '=', '==', '!=', 'not', 'isnt', "isn't", 'contains', 'includes', 'has', 'like')
const UNTAG_VERBS = words('untag', 'unlabel')
const CLEAR_VERBS = words('clear', 'empty', 'blank', 'unset', 'reset', 'wipe', 'erase')
const NEXT_WORDS = words('next', 'advance')
const PREV_WORDS = words('previous', 'prev')
const CYCLE_WORDS = words('cycle', 'rotate')
const DECIMAL_WORDS = words('decimal', 'decimals', 'place', 'places', 'dp', 'digit', 'digits')
const CREATE_VERBS = words('new', 'create', 'add', 'insert')
const RECORD_NOUNS = words('record', 'row', 'entry', 'item', 'line')
const FILL_VERBS = words('fill', 'copy', 'drag', 'repeat', 'number', 'renumber', 'continue', 'extend', 'cycle', 'rotate', 'one')

/** Two-word phrases read as one verb. */
const CASE_PHRASES: Array<[string[], 'upper' | 'lower' | 'title' | 'capitalize']> = [
  [['upper', 'case'], 'upper'],
  [['lower', 'case'], 'lower'],
  [['title', 'case'], 'title'],
  [['sentence', 'case'], 'capitalize'],
  [['all', 'caps'], 'upper'],
  [['caps'], 'upper'],
]
const SUB_PHRASES = [
  ['take', 'off'],
  ['knock', 'off'],
  ['take', 'away'],
]
const BRING_PHRASES = [
  ['bring', 'forward'],
  ['pull', 'forward'],
  ['bring', 'in'],
  ['pull', 'in'],
  ['move', 'up'],
]
const ROUND_DIRECTIONS: Record<string, 'floor' | 'ceil'> = { down: 'floor', up: 'ceil' }

const SHORT_UNITS: Record<string, CmdDateUnit> = {
  mo: 'month',
  mos: 'month',
  mon: 'month',
  w: 'week',
  wk: 'week',
  wks: 'week',
  d: 'day',
  y: 'year',
  yr: 'year',
  yrs: 'year',
  h: 'hour',
  hr: 'hour',
  hrs: 'hour',
  min: 'minute',
  mins: 'minute',
  m: 'minute',
}

/* ------------------------------------------------------------------------------ terminal values */

/** A change, before it is pointed at a field. `link`: the field an option or member names. */
interface OpT {
  edit: CmdRelativeEdit
  link?: string
  /** A verb, sign or symbol says this is an edit; "at most 100" alone could be a filter. */
  verb: boolean
}

interface DurT {
  amount: number
  unit: CmdDateUnit
}

/** An edit pointed at a field (absent: the surface's active field). */
interface EcT {
  field?: FieldT
  op: CmdNlEdit['op']
}

type CPartT =
  | { at: 'field'; fieldId: string; value: Scalar | Scalar[] }
  | { at: 'num'; value: number }
  | { at: 'date'; value: Scalar }
  | { at: 'me' }
  | { at: 'text'; text: string }

/* ------------------------------------------------------------------------------------- lattice */

const startsWith = (ws: string[], i: number, phrase: string[]) => phrase.every((p, k) => ws[i + k] === p)

/** Fills are whole commands; the rest of the query from `i` must read as one. */
function fillAt(ctx: CmdNlCtx, ws: string[], i: number): CmdFill | undefined {
  const rest = ws.slice(i).join(' ')
  const raw = ctx.tokens
    .slice(i)
    .map((t) => (t.quoted ? `"${t.text}"` : t.text))
    .join(' ')
  const N = String.raw`(-?\d[\d,]*(?:\.\d+)?(?:k|m)?)`
  const numOf = (s: string) => readCmdNumber(s.replace(/,/g, ''))?.value

  if (
    /^(?:fill|copy|drag)(?: it| them| values?)? down(?: from(?: the)? top)?$|^fill$|^repeat(?: the)?(?: first| top)?(?: value| cell| row| one)? down$/.test(
      rest,
    )
  )
    return { kind: 'down' }

  const numbering = new RegExp(
    String.raw`^(?:renumber|number)(?: the)?(?: rows| records| cells| lines)?(?: from ${N})?(?: (?:step|by|every) ${N})?$`,
  ).exec(rest)
  if (numbering && (rest.startsWith('renumber') || /^number(?: the)? (?:rows|records|cells|lines)/.test(rest))) {
    const start = numbering[1] ? numOf(numbering[1]) : 1
    const step = numbering[2] ? numOf(numbering[2]) : 1
    return start !== undefined && step ? { kind: 'number', start, step } : undefined
  }
  if (/^(?:continue|extend)(?: the)? (?:series|pattern|sequence)$|^fill(?: the| a| in)? (?:series|pattern|sequence)$/.test(rest))
    return { kind: 'series' }
  if (/^(?:fill )?(?:cycle|rotate)(?: through)?(?: the)? options$|^fill(?: the)? (?:options|cycle)$/.test(rest))
    return { kind: 'cycle' }

  // Dates: "daily from today", "fill dates weekly", "one per day starting today", "every 2 days from monday".
  const dates =
    /^(?:fill )?(?:with )?(?:dates? )?(?:(daily|weekly|fortnightly|biweekly|monthly|quarterly|yearly|annually|weekdays|business days|working days)|(?:every|each)(?: (\d+))? (day|week|month|year|weekday)s?|one (?:per|a|each|every) (day|week|month|year|weekday))?(?: (?:from|starting|starting from|starting on|beginning|beginning on|since) (.+))?$/.exec(
      rest,
    )
  if (dates && (dates[1] || dates[3] || dates[4] || (/^(?:fill )?(?:with )?dates?\b/.test(rest) && dates[5]))) {
    const periods: Record<string, [CmdFillUnit, number]> = {
      'daily': ['day', 1],
      'weekly': ['week', 1],
      'fortnightly': ['week', 2],
      'biweekly': ['week', 2],
      'monthly': ['month', 1],
      'quarterly': ['month', 3],
      'yearly': ['year', 1],
      'annually': ['year', 1],
      'weekdays': ['weekday', 1],
      'business days': ['weekday', 1],
      'working days': ['weekday', 1],
    }
    const period = dates[1] ? periods[dates[1]] : undefined
    const unit = period?.[0] ?? ((dates[3] ?? dates[4]) as CmdFillUnit | undefined) ?? 'day'
    const step = (period?.[1] ?? 1) * (dates[2] ? Number(dates[2]) : 1)
    const from = dates[5]?.trim()
    if (from && !resolveCmdFillDate(from, ctx.now)) return
    if (!rest.startsWith('fill') && !rest.startsWith('one') && !dates[1] && !dates[3]) return
    return step > 0 ? { kind: 'date', unit, step, ...(from ? { from } : {}) } : undefined
  }

  if (!rest.startsWith('fill ')) return
  const body = rest.slice(5).replace(/^with /, '')

  // "fill 1, 2, 3", "fill 10 20 30": an arithmetic series from the first two.
  const list = body.split(/\s*,\s*|\s+/).filter(Boolean)
  if (list.length >= 2 && list.every((x) => numOf(x) !== undefined)) {
    const values = list.map((x) => numOf(x)!)
    const step = values[1]! - values[0]!
    if (!step || values.some((v, k) => k && v - values[k - 1]! !== step)) return
    return { kind: 'number', start: values[0]!, step }
  }
  const range = new RegExp(
    String.raw`^(?:from )?${N}(?:\s?(?:\.\.\.?|…)\s?|\s(?:to|through|thru)\s|\s?-\s?)${N}?(?: (?:step|by|every) ${N})?$`,
  ).exec(body)
  if (range) {
    const start = numOf(range[1]!)
    const end = range[2] ? numOf(range[2]) : undefined
    const step = range[3] ? numOf(range[3]) : end !== undefined && start !== undefined && end < start ? -1 : 1
    if (start === undefined || !step) return
    return end === undefined ? { kind: 'number', start, step } : { kind: 'number', start, step, end }
  }
  const fromStep = new RegExp(String.raw`^from ${N}(?: (?:step|by|every|increment) ${N})?$`).exec(body)
  if (fromStep) {
    const start = numOf(fromStep[1]!)
    const step = fromStep[2] ? numOf(fromStep[2]) : 1
    return start !== undefined && step ? { kind: 'number', start, step } : undefined
  }
  const single = list.length === 1 ? numOf(list[0]!) : undefined
  if (single !== undefined) return { kind: 'constant', value: String(single), quoted: false }

  // Text series on the typed casing: "Item 1..10", "'INV-' 100..", "Week 1 to 12". The prefix keeps its space.
  const rawBody = raw.slice(raw.toLowerCase().indexOf('fill') + 5).replace(/^with /i, '')
  const SEP = String.raw`(?:\s?(?:\.\.\.?|…)\s?|\s(?:to|through)\s|-)`
  const series =
    new RegExp(String.raw`^"([^"]*)"\s?(\d+)${SEP}(\d+)?$`).exec(rawBody) ??
    new RegExp(String.raw`^([^"]*?\D)(\d+)${SEP}(\d+)?$`).exec(rawBody)
  if (series && /\p{L}/u.test(series[1]!)) {
    const start = Number(series[2])
    const end = series[3] !== undefined ? Number(series[3]) : undefined
    const step = end !== undefined && end < start ? -1 : 1
    return end === undefined
      ? { kind: 'text', prefix: series[1]!, start, step }
      : { kind: 'text', prefix: series[1]!, start, step, end }
  }
  const quoted = /^"(.*)"$/.exec(rawBody)
  if (quoted) return { kind: 'constant', value: quoted[1]!, quoted: true }
  // An unquoted constant must be an option or a date word ("fill out form" is not a fill).
  const isOption = ctx.schema.fields.some((f) => f.options?.some((o) => o.toLowerCase() === body))
  if (isOption || resolveCmdFillDate(body, ctx.now)) return { kind: 'constant', value: rawBody, quoted: false }
}

/** Edit, fill and create terminals for the lattice. */
export function addEditTerminals(ctx: CmdNlCtx, ws: string[], add: Add) {
  const { tokens, lex } = ctx
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const w = ws[i]!
    const next = ws[i + 1] ?? ''
    if (t.quoted) continue

    if (SET_VERBS.has(w)) add('SETV', i, i + 1)
    if (AS_WORDS.has(w)) add('ASW', i, i + 1)
    if (ASSIGN_VERBS.has(w)) add('ASSIGNV', i, i + 1)
    if (UNASSIGN_VERBS.has(w)) add('UNASSIGNV', i, i + 1)
    if (GIVE_VERBS.has(w)) add('GIVEV', i, i + 1)
    if (TAKE_VERBS.has(w)) add('TAKEV', i, i + 1)
    if (SHIFT_VERBS.has(w)) add('SHIFTV', i, i + 1)
    if (ADD_VERBS.has(w)) add('ADDV', i, i + 1)
    if (SUB_VERBS.has(w)) add('SUBV', i, i + 1)
    for (const p of SUB_PHRASES) if (startsWith(ws, i, p)) add('SUBV', i, i + p.length)
    for (const p of BRING_PHRASES) if (startsWith(ws, i, p)) add('BRINGV', i, i + p.length)
    if (MUL_VERBS.has(w)) add('MULV', i, i + 1)
    if (DIV_VERBS.has(w)) add('DIVV', i, i + 1)
    if (DOUBLE_VERBS[w] !== undefined) add('DOUBLEV', i, i + 1, DOUBLE_VERBS[w])
    if (BARE_NUMBER_OPS[w]) add('BAREOP', i, i + 1, BARE_NUMBER_OPS[w])
    if (w === 'absolute') add('BAREOP', i, next === 'value' ? i + 2 : i + 1, 'abs')
    if (w === 'round') {
      add('ROUNDV', i, i + 1)
      if (ROUND_DIRECTIONS[next]) add('BAREOP', i, i + 2, ROUND_DIRECTIONS[next])
    }
    if (w === 'nearest') add('NEARESTW', i, i + 1)
    if (DECIMAL_WORDS.has(w)) add('DECW', i, i + 1)
    if (CAP_VERBS.has(w)) add('CAPV', i, i + 1)
    if (MIN_VERBS.has(w)) add('MINV', i, i + 1)
    if (POINT_UNITS[w]) add('PTS', i, i + 1, POINT_UNITS[w])
    if (MORE_WORDS.has(w)) add('MOREW', i, i + 1)
    if (LESS_WORDS.has(w)) add('LESSW', i, i + 1)
    if (LATER_WORDS.has(w)) add('LATERW', i, i + 1)
    if (EARLIER_WORDS.has(w)) add('EARLIERW', i, i + 1)
    if (w === 'from' || w === 'off' || w === 'on') add('FROMW', i, i + 1)
    if (w === 'with') add('WITHW', i, i + 1)
    if (w === '+') add('PLUSW', i, i + 1)
    if (w === '=' || w === '==') add('EQSYM', i, i + 1)
    if (w === '-' || w === '−') add('MINUSW', i, i + 1)

    // Text
    if (TEXT_CASE_OPS[w]) add('CASEOP', i, i + 1, TEXT_CASE_OPS[w])
    for (const [p, op] of CASE_PHRASES) if (startsWith(ws, i, p)) add('CASEOP', i, i + p.length, op)
    if (APPEND_VERBS.has(w)) add('APPENDV', i, i + 1)
    if (PREPEND_VERBS.has(w)) add('PREPENDV', i, i + 1)
    if (REPLACE_VERBS.has(w)) add('REPLACEV', i, i + 1)
    if (REMOVE_VERBS.has(w)) add('REMOVEV', i, i + 1)

    // Checkbox, options, select, clear
    if (CHECK_VERBS.has(w)) add('CHECKV', i, i + 1)
    if (UNCHECK_VERBS.has(w)) add('UNCHECKV', i, i + 1)
    if (TOGGLE_VERBS.has(w)) add('TOGGLEV', i, i + 1)
    // "tag is chore" names the field; "tag as urgent" / "tag urgent" is the verb.
    if (TAG_VERBS.has(w) && !COPULAS.has(next)) add('TAGV', i, i + 1)
    if (UNTAG_VERBS.has(w)) add('UNTAGV', i, i + 1)
    if (CLEAR_VERBS.has(w)) add('CLEARV', i, i + 1)
    if (NEXT_WORDS.has(w)) add('NEXTW', i, i + 1)
    if (PREV_WORDS.has(w)) add('PREVW', i, i + 1)
    if (CYCLE_WORDS.has(w)) add('CYCLEW', i, i + 1)
    // "archive done tasks": a verb form of a checkbox's name ("Archived", "Signed").
    for (const box of fieldsOf(ctx, ['checkbox'])) {
      const title = box.title.toLowerCase()
      const un = w.startsWith('un') && w.length > 5
      const stem = un ? w.slice(2) : w
      if (stem.length >= 4 && stem !== title && (title === `${stem}d` || title === `${stem}ed` || title === `${stem}ped`)) {
        add('BOXV', i, i + 1, { fieldId: box.id, check: !un })
      }
    }

    // Numbers with a sign or symbol: "+10%", "-5", "x2", "+1w".
    const signed = /^[+\-−]/.test(t.text) ? readCmdNumber(t.word) : undefined
    if (signed) add('SIGNED', i, i + 1, { amount: (t.text.startsWith('+') ? 1 : -1) * signed.value, percent: !!signed.percent })
    const mult = /^[x×*](\d+(?:\.\d+)?)$/i.exec(t.text)
    if (mult) add('XMUL', i, i + 1, Number(mult[1]))
    const shortDur = /^([+\-−])(\d+(?:\.\d+)?)([a-z]+)$/i.exec(t.text)
    if (shortDur && SHORT_UNITS[shortDur[3]!.toLowerCase()] && Number.isInteger(Number(shortDur[2]))) {
      const amount = (shortDur[1] === '+' ? 1 : -1) * Number(shortDur[2])
      add('SIGNDUR', i, i + 1, { amount, unit: SHORT_UNITS[shortDur[3]!.toLowerCase()]! } satisfies DurT)
    }
    const num = numberAt(tokens, i)
    if (num?.percent) add('PCT', i, num.end, Math.abs(num.value))

    // Durations: "a week", "7 days", "2 months".
    const amount = num?.value ?? (['a', 'an', 'one'].includes(w) ? 1 : undefined)
    const unitAt = num ? num.end : i + 1
    const unit = amount !== undefined ? DATE_UNITS[ws[unitAt] ?? ''] : undefined
    if (unit && ws[unitAt] !== 'm') {
      const n = Math.abs(amount!) * unit[1]
      // "7 days" is "a week": the shift reads the same either way, so keep one canonical form.
      const weeks = unit[0] === 'day' && n % 7 === 0
      add('DUR', i, unitAt + 1, (weeks ? { amount: n / 7, unit: 'week' } : { amount: n, unit: unit[0] }) satisfies DurT)
    }

    // Dates as targets: "next friday", "end of month", "eom".
    const which = { next: 'next', this: 'this', coming: 'this', last: 'last', previous: 'last' }[w] as
      | 'next'
      | 'this'
      | 'last'
      | undefined
    if (which && WEEKDAY_NAMES[next] !== undefined) add('WDAY', i, i + 2, { weekday: WEEKDAY_NAMES[next]!, which })
    const abbrev = /^(eo|so)(w|m|y)$/.exec(w)
    if (abbrev) {
      add('EDGE', i, i + 1, {
        op: abbrev[1] === 'eo' ? 'end-of' : 'start-of',
        unit: { w: 'week', m: 'month', y: 'year' }[abbrev[2] as 'w'],
        offset: 0,
      })
    }
    if ((w === 'end' || w === 'start' || w === 'beginning') && next === 'of') {
      let j = i + 2
      if (ws[j] === 'the') j++
      const offset = { next: 1, last: -1, previous: -1, this: 0 }[ws[j] ?? ''] as number | undefined
      if (offset !== undefined) j++
      const period = ws[j]
      if (period === 'week' || period === 'month' || period === 'year') {
        add('EDGE', i, j + 1, { op: w === 'end' ? 'end-of' : 'start-of', unit: period, offset: offset ?? 0 })
      }
    }

    // Options and members by their typed text, for edits that keep it.
    for (const m of cmdNlLexAt(lex, ws, i, ['value'])) {
      const field = cmdNlField(ctx.schema, m.entry.fieldId)
      if (field?.kind === 'multiselect')
        add('TAGOPT', i, m.end, { fieldId: field.id, option: m.entry.value!.toLowerCase() }, m.score)
    }

    // Creates: "new deal", "add record", "create task".
    if (CREATE_VERBS.has(w) && (lex.tableNouns.has(next) || RECORD_NOUNS.has(next))) add('CREATEV', i, i + 2)

    // Fills read the rest of the query as one command.
    if (FILL_VERBS.has(w)) {
      const fill = fillAt(ctx, ws, i)
      if (fill) add('FILLOP', i, tokens.length, fill)
    }
  }
}

/* --------------------------------------------------------------------------- semantic helpers */

const RELATIVE_KINDS: Record<CmdRelativeEdit['kind'], CmdNlField['kind'][]> = {
  number: ['number'],
  date: ['date', 'datetime'],
  text: ['text'],
  checkbox: ['checkbox'],
  select: ['select'],
  option: ['multiselect'],
  user: ['user'],
}

function fits(field: CmdNlField, edit: CmdRelativeEdit) {
  if (field.readonly || !RELATIVE_KINDS[edit.kind].includes(field.kind)) return false
  if (edit.kind === 'option' && edit.op !== 'clear') return !!field.options?.some((o) => o.toLowerCase() === edit.option)
  return true
}

const op = (edit: CmdRelativeEdit, verb = true, link?: string): OpT => ({ edit, verb, link })
const numOp = (amount: number, percent: boolean, unit?: 'points' | 'stars'): OpT | undefined => {
  if (!Number.isFinite(amount)) return
  if (percent) return unit ? undefined : op({ kind: 'number', op: 'percent', amount })
  return op(unit ? { kind: 'number', op: 'add', amount, unit } : { kind: 'number', op: 'add', amount })
}
const shiftOp = (d: DurT, sign: 1 | -1, verb = true): OpT =>
  op({ kind: 'date', op: 'shift', amount: sign * d.amount, unit: d.unit }, verb)
const num = (k: unknown) => (k as ValT & { t: 'num' }).value
const isPct = (k: unknown) => !!(k as ValT & { t: 'num' }).percent
const dur = (k: unknown) => k as DurT

interface AmountT {
  amount: number
  percent: boolean
  unit?: 'points' | 'stars'
}

/** A decrease is a negative amount (`percent: -20` for "cut by 20%"), as the legacy edit parser writes it. */
const amountOp = (a: AmountT, sign: 1 | -1) => numOp(sign * a.amount, a.percent, a.unit)

/** An op pointed at `target` (or at the field its value names, or the active field). */
function editCore(ctx: CmdNlCtx, o: OpT, target?: FieldT): EcT | ChartScaled | undefined {
  if (!target) {
    if (!o.verb) return
    if (o.link) {
      const linked = cmdNlField(ctx.schema, o.link)
      if (!linked || !fits(linked, o.edit)) return
      return new ChartScaled(
        { field: { fieldId: linked.id, via: 'value', words: [] }, op: { kind: 'relative', edit: o.edit } },
        0.97,
      )
    }
    return new ChartScaled({ op: { kind: 'relative', edit: o.edit } }, 0.9)
  }
  const field = F(ctx, target)
  if (!field || (o.link && o.link !== field.id) || !fits(field, o.edit)) return
  const ec: EcT = { field: target, op: { kind: 'relative', edit: { ...o.edit, field: target.words.join(' ') } } }
  // Without a verb ("qty at most 100") the edit stays behind a filter reading, close enough to be unsure.
  return o.verb ? ec : new ChartScaled(ec, 0.9)
}

const relOn = (ctx: CmdNlCtx, target: FieldT, edit: CmdRelativeEdit) => editCore(ctx, op(edit), target)

function setOn(field: CmdNlField | undefined, v: ValT, via: FieldRef['via'], words: string[]): EcT | undefined {
  if (!field || field.readonly) return
  const value = fitSet(field, v)
  return value === undefined ? undefined : { field: { fieldId: field.id, via, words }, op: { kind: 'set', value } }
}

/** The field a bare value ("won", "ann", "me") writes to. */
function valueField(ctx: CmdNlCtx, v: ValT): CmdNlField | undefined {
  if (v.t === 'opt' || v.t === 'member') return cmdNlField(ctx.schema, v.fieldId)
  if (v.t === 'me') return pickField(fieldsOf(ctx, ['user']), ['owner', 'assign'])
}

const editOut = (ec: EcT, where?: Cond): Body => ({
  intent: 'edit',
  scope: where ? 'where' : 'selection',
  where,
  edits: [{ field: ec.field ? ref(ec.field.fieldId, ec.field.via) : undefined, op: ec.op }],
})

function createBody(ctx: CmdNlCtx, parts: CPartT[]): Body | undefined {
  const values: Record<string, Scalar | Scalar[]> = {}
  const free = (f: CmdNlField) => !f.readonly && values[f.id] === undefined
  for (const p of parts) {
    if (p.at !== 'field') continue
    if (values[p.fieldId] !== undefined) return
    values[p.fieldId] = p.value
  }
  for (const p of parts) {
    if (p.at === 'me') {
      const user = pickField(fieldsOf(ctx, ['user']).filter(free), ['owner', 'assign'])
      if (!user) return
      values[user.id] = { me: true }
    } else if (p.at === 'date') {
      const preferred = dateField(ctx)
      const date = preferred && free(preferred) ? preferred : fieldsOf(ctx, ['date', 'datetime']).find(free)
      if (!date) return
      values[date.id] = p.value
    } else if (p.at === 'num') {
      const target = fieldsOf(ctx, ['number']).find(free)
      if (!target) return
      values[target.id] = p.value
    }
  }
  const text = parts
    .filter((p): p is CPartT & { at: 'text' } => p.at === 'text')
    .map((p) => p.text)
    .join(' ')
    .trim()
  if (text) {
    const display = ctx.schema.fields.find((f) => f.pv && (f.kind === 'text' || f.kind === 'other')) ?? fieldsOf(ctx, ['text'])[0]
    if (!display || !free(display)) return
    values[display.id] = text
  }
  return Object.keys(values).length ? { intent: 'create', scope: 'view', create: { values } } : undefined
}

const fillOut = (fill: CmdFill, field?: FieldT): Body => ({
  intent: 'fill',
  scope: 'selection',
  edits: [{ field: field ? ref(field.fieldId, field.via) : undefined, op: { kind: 'fill', fill } }],
})

/* ---------------------------------------------------------------------------------------- rules */

const ecT = (k: unknown) => k as EcT
const opT = (k: unknown) => k as OpT
const cond = (k: unknown) => k as Cond
const textOf = (k: unknown) => (typeof k === 'string' ? k : (k as ValT & { t: 'quoted' }).text)

export const EDIT_RULES: R[] = [
  /* ------------------------------------------------------------------------------ edit, scoped */
  r('Edit', 'EC', 1, (k) => editOut(ecT(k[0]))),
  // "set stage won where amount > 10000", "add a week to due for blocked tasks"
  r('Edit', 'EC Expr', 0.98, (k) => editOut(ecT(k[0]), cond(k[1]))),
  // "mark deals over 10000 as won", "set blocked tasks to me"
  r('Edit', 'SETV Expr ASW Val', 0.95, (k, ctx) => {
    const v = valT(k[3])
    const ec = setOn(valueField(ctx, v), v, 'implicit', [])
    return ec ? editOut(ec, cond(k[1])) : undefined
  }),
  // "tag blocked tasks as urgent"
  r('Edit', 'TAGV Expr ASW TAGOPT', 0.95, (k, ctx) => {
    const t = k[3] as { fieldId: string; option: string }
    const field = cmdNlField(ctx.schema, t.fieldId)
    const edit: CmdRelativeEdit = { kind: 'option', op: 'add', option: t.option }
    if (!field || !fits(field, edit)) return
    return editOut({ field: { fieldId: field.id, via: 'value', words: [] }, op: { kind: 'relative', edit } }, cond(k[1]))
  }),
  // "assign unassigned tasks to me", "give unowned deals to ann"
  r('Edit', 'ASSIGNV Expr ASW Val', 0.95, (k, ctx) => assignWhere(ctx, valT(k[3]), cond(k[1]))),
  r('Edit', 'GIVEV Expr ASW Val', 0.95, (k, ctx) => assignWhere(ctx, valT(k[3]), cond(k[1]))),
  // "give ann the unowned deals"
  r('Edit', 'GIVEV Val Expr', 0.95, (k, ctx) => assignWhere(ctx, valT(k[1]), cond(k[2]))),
  // "take all unassigned tasks"
  r('Edit', 'TAKEV Expr', 0.9, (k, ctx) => assignWhere(ctx, { t: 'me' }, cond(k[1]))),
  // "push blocked tasks by a week", "delay blocked tasks 7 days", "bring forward lost deals 2 days"
  r('Edit', 'SHIFTV Expr DUR', 0.95, (k, ctx) => shiftWhere(ctx, shiftOp(dur(k[2]), 1), cond(k[1]))),
  r('Edit', 'SHIFTV Expr BY DUR', 0.95, (k, ctx) => shiftWhere(ctx, shiftOp(dur(k[3]), 1), cond(k[1]))),
  r('Edit', 'BRINGV Expr DUR', 0.95, (k, ctx) => shiftWhere(ctx, shiftOp(dur(k[2]), -1), cond(k[1]))),
  r('Edit', 'BRINGV Expr BY DUR', 0.95, (k, ctx) => shiftWhere(ctx, shiftOp(dur(k[3]), -1), cond(k[1]))),
  // "archive done tasks"
  r('Edit', 'BOXV Expr', 0.95, (k, ctx) => boxWhere(ctx, k[0] as { fieldId: string; check: boolean }, cond(k[1]))),

  /* --------------------------------------------------------------------- an edit on one field */
  r('EC', 'Op', 1, (k, ctx) => editCore(ctx, opT(k[0]))),
  r('EC', 'Op FIELD', 1, (k, ctx) => editCore(ctx, opT(k[0]), fieldT(k[1]))),
  r('EC', 'Op FROMW FIELD', 1, (k, ctx) => editCore(ctx, opT(k[0]), fieldT(k[2]))),
  r('EC', 'FIELD Op', 1, (k, ctx) => editCore(ctx, opT(k[1]), fieldT(k[0]))),
  // "make title upper case", "set close date to next friday", "change due to end of month"
  r('EC', 'SETV FIELD Op', 1, (k, ctx) => editCore(ctx, { ...opT(k[2]), verb: true }, fieldT(k[1]))),
  r('EC', 'SHIFTV FIELD Op', 1, (k, ctx) => editCore(ctx, { ...opT(k[2]), verb: true }, fieldT(k[1]))),
  // "increase amount by 10%", "multiply amount by 2", "cut price 5"
  r('EC', 'ADDV FIELD BY Amount', 1, (k, ctx) => amountOn(ctx, fieldT(k[1]), k[3] as AmountT, 1)),
  r('EC', 'ADDV FIELD Amount', 0.97, (k, ctx) => amountOn(ctx, fieldT(k[1]), k[2] as AmountT, 1)),
  r('EC', 'SUBV FIELD BY Amount', 1, (k, ctx) => amountOn(ctx, fieldT(k[1]), k[3] as AmountT, -1)),
  r('EC', 'SUBV FIELD Amount', 0.97, (k, ctx) => amountOn(ctx, fieldT(k[1]), k[2] as AmountT, -1)),
  r('EC', 'MULV FIELD BY NUM', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'multiply', amount: num(k[3]) })),
  r('EC', 'DIVV FIELD BY NUM', 1, (k, ctx) =>
    num(k[3]) ? relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'divide', amount: num(k[3]) }) : undefined,
  ),
  r('EC', 'DOUBLEV FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'multiply', amount: k[0] as number })),
  r('EC', 'BAREOP FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'number', op: k[0] as 'abs' })),
  r('EC', 'ROUNDV FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'round', amount: 0 })),
  r('EC', 'ROUNDV FIELD NUM DECW', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'round', amount: num(k[2]) })),
  r('EC', 'ROUNDV FIELD NEARESTW NUM', 1, (k, ctx) =>
    num(k[3]) ? relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'round-nearest', amount: num(k[3]) }) : undefined,
  ),
  // "cap qty at 100", "limit qty to 100", "min price 5"
  r('EC', 'CAPV FIELD NUM', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'at-most', amount: num(k[2]) })),
  r('EC', 'MINV FIELD NUM', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'number', op: 'at-least', amount: num(k[2]) })),
  // "push close date by a week", "move due 2 days later", "bring close date forward a week"
  r('EC', 'SHIFTV FIELD DUR', 1, (k, ctx) => editCore(ctx, shiftOp(dur(k[2]), 1), fieldT(k[1]))),
  r('EC', 'SHIFTV FIELD BY DUR', 1, (k, ctx) => editCore(ctx, shiftOp(dur(k[3]), 1), fieldT(k[1]))),
  r('EC', 'SHIFTV FIELD DUR EARLIERW', 1, (k, ctx) => editCore(ctx, shiftOp(dur(k[2]), -1), fieldT(k[1]))),
  r('EC', 'BRINGV FIELD DUR', 1, (k, ctx) => editCore(ctx, shiftOp(dur(k[2]), -1), fieldT(k[1]))),
  r('EC', 'BRINGV FIELD BY DUR', 1, (k, ctx) => editCore(ctx, shiftOp(dur(k[3]), -1), fieldT(k[1]))),
  // Checkbox, select, clear
  r('EC', 'CHECKV FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'checkbox', op: 'check' })),
  r('EC', 'UNCHECKV FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'checkbox', op: 'uncheck' })),
  r('EC', 'TOGGLEV FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'checkbox', op: 'toggle' })),
  r('EC', 'NEXTW FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'select', op: 'next' })),
  r('EC', 'PREVW FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'select', op: 'previous' })),
  r('EC', 'CYCLEW FIELD', 1, (k, ctx) => relOn(ctx, fieldT(k[1]), { kind: 'select', op: 'cycle' })),
  r('EC', 'CLEARV FIELD', 1, (k, ctx) => {
    const target = fieldT(k[1])
    const field = F(ctx, target)
    return field && !field.readonly ? ({ field: target, op: { kind: 'clear' } } satisfies EcT) : undefined
  }),
  r('EC', 'BOXV', 0.95, (k, ctx) => {
    const box = k[0] as { fieldId: string; check: boolean }
    const field = cmdNlField(ctx.schema, box.fieldId)
    return field
      ? relOn(ctx, { fieldId: field.id, via: 'synonym', words: [] }, { kind: 'checkbox', op: box.check ? 'check' : 'uncheck' })
      : undefined
  }),
  // Absolute sets: "set stage won", "set stage to won", "change amount = 5", "set city to new york", "mark as won"
  r('EC', 'SETV FIELD Val', 1, (k, ctx) => setOn(F(ctx, fieldT(k[1])), valT(k[2]), fieldT(k[1]).via, fieldT(k[1]).words)),
  r('EC', 'SETV FIELD ASW Val', 1, (k, ctx) => setOn(F(ctx, fieldT(k[1])), valT(k[3]), fieldT(k[1]).via, fieldT(k[1]).words)),
  r('EC', 'SETV FIELD CMP Val', 1, (k, ctx) =>
    k[2] === 'eq' ? setOn(F(ctx, fieldT(k[1])), valT(k[3]), fieldT(k[1]).via, fieldT(k[1]).words) : undefined,
  ),
  r('EC', 'SETV FIELD TextRun', 0.9, (k, ctx) => setText(ctx, fieldT(k[1]), k[2] as string)),
  r('EC', 'SETV FIELD ASW TextRun', 0.9, (k, ctx) => setText(ctx, fieldT(k[1]), k[3] as string)),
  // "stage = won" with no verb: a filter, or a set on the selection; both come back, the filter first.
  // Only the "=" sign: "tag is chore" is just a filter.
  r('EC', 'FIELD EQSYM Val', 1, (k, ctx) => {
    const ec = setOn(F(ctx, fieldT(k[0])), valT(k[2]), fieldT(k[0]).via, fieldT(k[0]).words)
    return ec ? new ChartScaled(ec, 0.9) : undefined
  }),
  // Checkboxes: "mark signed", "mark as active" check; "mark inactive", "mark as not active", "mark unsigned" uncheck.
  r('EC', 'SETV FIELD', 1, (k, ctx) => boxOn(ctx, fieldT(k[1]), true)),
  r('EC', 'SETV ASW FIELD', 1, (k, ctx) => boxOn(ctx, fieldT(k[2]), true)),
  r('EC', 'SETV NEG FIELD', 1, (k, ctx) => boxOn(ctx, fieldT(k[2]), false)),
  r('EC', 'SETV ASW NEG FIELD', 1, (k, ctx) => boxOn(ctx, fieldT(k[3]), false)),
  r('EC', 'SETV STATE', 1, (k, ctx) => boxState(ctx, k[1] as Cond)),
  r('EC', 'SETV ASW STATE', 1, (k, ctx) => boxState(ctx, k[2] as Cond)),
  r('EC', 'SETV UNF', 1, (k, ctx) => {
    const un = k[1] as { fieldId: string; cmp: string }
    const field = cmdNlField(ctx.schema, un.fieldId)
    return field?.kind === 'checkbox' ? boxOn(ctx, { fieldId: field.id, via: 'synonym', words: [] }, false) : undefined
  }),
  r('EC', 'SETV Val', 0.95, (k, ctx) =>
    valT(k[1]).t === 'opt' ? setOn(valueField(ctx, valT(k[1])), valT(k[1]), 'value', []) : undefined,
  ),
  r('EC', 'SETV ASW Val', 0.97, (k, ctx) => {
    const v = valT(k[2])
    return v.t === 'opt' || v.t === 'member' ? setOn(valueField(ctx, v), v, 'value', []) : undefined
  }),

  /* -------------------------------------------------------------------- the change, unpointed */
  r('Op', 'SIGNED', 1, (k) => {
    const s = k[0] as { amount: number; percent: boolean }
    return numOp(s.amount, s.percent)
  }),
  r('Op', 'SIGNED PTS', 1, (k) => {
    const s = k[0] as { amount: number; percent: boolean }
    return numOp(s.amount, s.percent, k[1] as 'points')
  }),
  r('Op', 'PLUSW NUM', 1, (k) => numOp(num(k[1]), false)),
  r('Op', 'MINUSW NUM', 1, (k) => numOp(-num(k[1]), false)),
  r('Op', 'ADDV Amount', 1, (k) => amountOp(k[1] as AmountT, 1)),
  r('Op', 'ADDV BY Amount', 1, (k) => amountOp(k[2] as AmountT, 1)),
  r('Op', 'SUBV Amount', 1, (k) => amountOp(k[1] as AmountT, -1)),
  r('Op', 'SUBV BY Amount', 1, (k) => amountOp(k[2] as AmountT, -1)),
  // "10% more", "5 less"
  r('Op', 'Amount MOREW', 1, (k) => amountOp(k[0] as AmountT, 1)),
  r('Op', 'Amount LESSW', 1, (k) => amountOp(k[0] as AmountT, -1)),
  r('Op', 'MULV NUM', 1, (k) => op({ kind: 'number', op: 'multiply', amount: num(k[1]) })),
  r('Op', 'MULV BY NUM', 1, (k) => op({ kind: 'number', op: 'multiply', amount: num(k[2]) })),
  r('Op', 'XMUL', 1, (k) => op({ kind: 'number', op: 'multiply', amount: k[0] as number })),
  r('Op', 'DIVV NUM', 1, (k) => (num(k[1]) ? op({ kind: 'number', op: 'divide', amount: num(k[1]) }) : undefined)),
  r('Op', 'DIVV BY NUM', 1, (k) => (num(k[2]) ? op({ kind: 'number', op: 'divide', amount: num(k[2]) }) : undefined)),
  r('Op', 'DOUBLEV', 1, (k) => op({ kind: 'number', op: 'multiply', amount: k[0] as number })),
  r('Op', 'BAREOP', 1, (k) => op({ kind: 'number', op: k[0] as 'abs' })),
  r('Op', 'ROUNDV', 1, () => op({ kind: 'number', op: 'round', amount: 0 })),
  r('Op', 'ROUNDV NUM DECW', 1, (k) => op({ kind: 'number', op: 'round', amount: num(k[1]) })),
  r('Op', 'ROUNDV NEARESTW NUM', 1, (k) =>
    num(k[2]) ? op({ kind: 'number', op: 'round-nearest', amount: num(k[2]) }) : undefined,
  ),
  r('Op', 'CAPV NUM', 1, (k) => op({ kind: 'number', op: 'at-most', amount: num(k[1]) })),
  r('Op', 'MINV NUM', 1, (k) => op({ kind: 'number', op: 'at-least', amount: num(k[1]) })),
  // "at most 100": a clamp, or a filter; no verb says which.
  r('Op', 'CMP NUM', 1, (k) =>
    k[0] === 'lte' || k[0] === 'gte'
      ? op({ kind: 'number', op: k[0] === 'lte' ? 'at-most' : 'at-least', amount: num(k[1]) }, false)
      : undefined,
  ),
  // Dates
  r('Op', 'ADDV DUR', 1, (k) => shiftOp(dur(k[1]), 1)),
  r('Op', 'ADDV BY DUR', 1, (k) => shiftOp(dur(k[2]), 1)),
  r('Op', 'SUBV DUR', 1, (k) => shiftOp(dur(k[1]), -1)),
  r('Op', 'SUBV BY DUR', 1, (k) => shiftOp(dur(k[2]), -1)),
  r('Op', 'SHIFTV DUR', 1, (k) => shiftOp(dur(k[1]), 1)),
  r('Op', 'SHIFTV BY DUR', 1, (k) => shiftOp(dur(k[2]), 1)),
  r('Op', 'BRINGV DUR', 1, (k) => shiftOp(dur(k[1]), -1)),
  r('Op', 'BRINGV BY DUR', 1, (k) => shiftOp(dur(k[2]), -1)),
  r('Op', 'SIGNDUR', 1, (k) => shiftOp({ ...dur(k[0]), amount: Math.abs(dur(k[0]).amount) }, dur(k[0]).amount < 0 ? -1 : 1)),
  r('Op', 'DUR LATERW', 1, (k) => shiftOp(dur(k[0]), 1)),
  r('Op', 'DUR EARLIERW', 1, (k) => shiftOp(dur(k[0]), -1)),
  r('Op', 'WDAY', 1, (k) => {
    const d = k[0] as { weekday: number; which: 'next' | 'this' | 'last' }
    return op({ kind: 'date', op: 'weekday', weekday: d.weekday, which: d.which }, false)
  }),
  r('Op', 'EDGE', 1, (k) => {
    const e = k[0] as { op: 'start-of' | 'end-of'; unit: 'week' | 'month' | 'year'; offset: number }
    return op({ kind: 'date', op: e.op, unit: e.unit, offset: e.offset }, false)
  }),
  // Text
  r('Op', 'CASEOP', 1, (k) => op({ kind: 'text', op: k[0] as 'upper' })),
  r('Op', 'APPENDV Txt', 1, (k) => op({ kind: 'text', op: 'append', text: textOf(k[1]) })),
  r('Op', 'ADDV QUOTED', 1, (k) => op({ kind: 'text', op: 'append', text: textOf(k[1]) })),
  r('Op', 'PREPENDV Txt', 1, (k) => op({ kind: 'text', op: 'prepend', text: textOf(k[1]) })),
  r('Op', 'REPLACEV Txt WITHW Txt', 1, (k) => op({ kind: 'text', op: 'replace', from: textOf(k[1]), to: textOf(k[3]) })),
  r('Op', 'REMOVEV QUOTED', 1, (k) => op({ kind: 'text', op: 'remove', text: textOf(k[1]) })),
  r('Txt', 'QUOTED', 1, (k) => textOf(k[0])),
  r('Txt', 'TextRun', 0.95),
  // Checkbox
  r('Op', 'CHECKV', 1, () => op({ kind: 'checkbox', op: 'check' })),
  r('Op', 'UNCHECKV', 1, () => op({ kind: 'checkbox', op: 'uncheck' })),
  r('Op', 'TOGGLEV', 1, () => op({ kind: 'checkbox', op: 'toggle' })),
  // Options: "add urgent to tags", "tag as urgent", "tags + urgent", "untag urgent"
  r('Op', 'ADDV TAGOPT', 1, (k) => optionOp('add', k[1])),
  r('Op', 'TAGV TAGOPT', 1, (k) => optionOp('add', k[1])),
  r('Op', 'TAGV ASW TAGOPT', 1, (k) => optionOp('add', k[2])),
  r('Op', 'PLUSW TAGOPT', 1, (k) => optionOp('add', k[1])),
  r('Op', 'REMOVEV TAGOPT', 1, (k) => optionOp('remove', k[1])),
  r('Op', 'UNTAGV TAGOPT', 1, (k) => optionOp('remove', k[1])),
  r('Op', 'MINUSW TAGOPT', 1, (k) => optionOp('remove', k[1])),
  r('Op', 'TOGGLEV TAGOPT', 1, (k) => optionOp('toggle', k[1])),
  // Users: "assign me", "assign ann", "unassign raj"
  r('Op', 'ASSIGNV Val', 1, (k, ctx) => userOp(ctx, 'add', valT(k[1]))),
  r('Op', 'ADDV MEMBER', 0.9, (k, ctx) => userOp(ctx, 'add', valT(k[1]))),
  r('Op', 'UNASSIGNV Val', 1, (k, ctx) => userOp(ctx, 'remove', valT(k[1]))),
  r('Op', 'REMOVEV MEMBER', 0.9, (k, ctx) => userOp(ctx, 'remove', valT(k[1]))),
  // Select
  r('Op', 'CYCLEW', 1, () => op({ kind: 'select', op: 'cycle' })),

  // "10%" is a percent change, never a plain 10.
  r('Amount', 'NUM', 1, (k) => (isPct(k[0]) ? undefined : ({ amount: num(k[0]), percent: false } satisfies AmountT))),
  r('Amount', 'PCT', 1, (k) => ({ amount: k[0] as number, percent: true } satisfies AmountT)),
  r('Amount', 'NUM PTS', 1, (k) =>
    isPct(k[0]) ? undefined : ({ amount: num(k[0]), percent: false, unit: k[1] as 'points' } satisfies AmountT),
  ),

  /* ------------------------------------------------------------------------------------- fills */
  r('Fill', 'FILLOP', 1, (k) => fillOut(k[0] as CmdFill)),

  /* ----------------------------------------------------------------------------------- creates */
  r('Create', 'CREATEV CParts', 1, (k, ctx) => createBody(ctx, k[1] as CPartT[])),
  r('CParts', 'CPart', 1, (k) => [k[0]]),
  r('CParts', 'CParts CPart', 1, (k) => [...(k[0] as CPartT[]), k[1]]),
  r('CParts', 'CParts COMMA CPart', 1, (k) => [...(k[0] as CPartT[]), k[2]]),
  r('CPart', 'FIELD Val', 1, (k, ctx) => createField(ctx, fieldT(k[0]), valT(k[1]))),
  r('CPart', 'FIELD ASW Val', 1, (k, ctx) => createField(ctx, fieldT(k[0]), valT(k[2]))),
  r('CPart', 'FIELD CMP Val', 1, (k, ctx) => (k[1] === 'eq' ? createField(ctx, fieldT(k[0]), valT(k[2])) : undefined)),
  r('CPart', 'FIELD TextRun', 0.95, (k, ctx) => {
    const field = F(ctx, fieldT(k[0]))
    if (!field || field.readonly || (field.kind !== 'text' && field.kind !== 'other')) return
    return { at: 'field', fieldId: field.id, value: k[1] as string } satisfies CPartT
  }),
  r('CPart', 'OPT', 0.97, (k, ctx) => {
    const v = valT(k[0]) as ValT & { t: 'opt' }
    const field = cmdNlField(ctx.schema, v.fieldId)
    const value = field && !field.readonly ? fitSet(field, v) : undefined
    return value === undefined ? undefined : ({ at: 'field', fieldId: v.fieldId, value } satisfies CPartT)
  }),
  r('CPart', 'MEMBER', 0.97, (k) => {
    const v = valT(k[0]) as ValT & { t: 'member' }
    return { at: 'field', fieldId: v.fieldId, value: { member: v.member } } satisfies CPartT
  }),
  r('CPart', 'ME', 0.97, () => ({ at: 'me' } satisfies CPartT)),
  r('CPart', 'DATE', 0.97, (k) => ({ at: 'date', value: (valT(k[0]) as ValT & { t: 'date' }).value } satisfies CPartT)),
  r('CPart', 'NUM', 0.97, (k) => ({ at: 'num', value: num(k[0]) } satisfies CPartT)),
  r('CPart', 'QUOTED', 1, (k) => ({ at: 'text', text: textOf(k[0]) } satisfies CPartT)),
  r('CPart', 'TEXTW', 1, (k) => ({ at: 'text', text: k[0] as string } satisfies CPartT)),
]

function amountOn(ctx: CmdNlCtx, target: FieldT, a: AmountT, sign: 1 | -1) {
  const o = amountOp(a, sign)
  return o ? editCore(ctx, o, target) : undefined
}

function optionOp(kind: 'add' | 'remove' | 'toggle', k: unknown): OpT {
  const t = k as { fieldId: string; option: string }
  return op({ kind: 'option', op: kind, option: t.option }, true, t.fieldId)
}

function userOp(ctx: CmdNlCtx, kind: 'add' | 'remove', v: ValT): OpT | undefined {
  if (v.t === 'me') return op({ kind: 'user', op: kind, who: 'me' }, true, valueField(ctx, v)?.id)
  if (v.t !== 'member') return
  const field = cmdNlField(ctx.schema, v.fieldId)
  const member = field?.members?.find((m) => m.id === v.member)
  return member ? op({ kind: 'user', op: kind, who: member.name }, true, v.fieldId) : undefined
}

/** A checkbox edit, as the relative op (`check` / `uncheck`) the checkbox executor runs. */
function boxOn(ctx: CmdNlCtx, target: FieldT, check: boolean) {
  const field = F(ctx, target)
  // A typo match ("inactive" ~ "Active") must not flip the meaning to "check".
  if (field?.kind !== 'checkbox' || (check && target.via === 'fuzzy')) return
  return relOn(ctx, target, { kind: 'checkbox', op: check ? 'check' : 'uncheck' })
}

/** "mark inactive": the state word's checkbox condition, turned into the edit that makes it true. */
function boxState(ctx: CmdNlCtx, state: Cond) {
  if (!('cmp' in state) || (state.cmp !== 'checked' && state.cmp !== 'notchecked')) return
  return boxOn(ctx, { fieldId: state.field.id, via: 'synonym', words: [] }, state.cmp === 'checked')
}

function setText(ctx: CmdNlCtx, target: FieldT, text: string): EcT | undefined {
  const field = F(ctx, target)
  if (!field || field.readonly || (field.kind !== 'text' && field.kind !== 'other')) return
  return { field: target, op: { kind: 'set', value: text } }
}

function assignWhere(ctx: CmdNlCtx, v: ValT, where: Cond): Body | undefined {
  if (v.t !== 'member' && v.t !== 'me') return
  const ec = setOn(valueField(ctx, v), v, 'implicit', [])
  return ec ? editOut(ec, where) : undefined
}

function shiftWhere(ctx: CmdNlCtx, o: OpT, where: Cond): Body | undefined {
  const date = dateField(ctx)
  if (!date || date.readonly) return
  return editOut({ field: { fieldId: date.id, via: 'implicit', words: [] }, op: { kind: 'relative', edit: o.edit } }, where)
}

function boxWhere(ctx: CmdNlCtx, box: { fieldId: string; check: boolean }, where: Cond): Body | undefined {
  const field = cmdNlField(ctx.schema, box.fieldId)
  if (!field || field.readonly) return
  const edit: CmdRelativeEdit = { kind: 'checkbox', op: box.check ? 'check' : 'uncheck' }
  return editOut({ field: { fieldId: field.id, via: 'synonym', words: [] }, op: { kind: 'relative', edit } }, where)
}

function createField(ctx: CmdNlCtx, target: FieldT, v: ValT): CPartT | undefined {
  const field = F(ctx, target)
  if (!field || field.readonly) return
  const value = fitSet(field, v)
  return value === undefined ? undefined : { at: 'field', fieldId: field.id, value }
}
