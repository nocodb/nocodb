import type { ChartEdge } from './chart'
import { ChartScaled, compileChartGrammar } from './chart'
import { cmdNlWordList, dateAt, numberAt, phraseAt, weekdayAt, windowAt } from './extract'
import type { CmdNlCmp, Cond, CondLeaf, FieldRef, Scalar } from './ir'
import { CMD_NL_SHARE, andConds, condLeaves, isCondLeaf } from './ir'
import { cmdNlLexAt, cmdNlWordMatch } from './lexicon'
import type { CmdNlCtx } from './procedural'
import { aggFor, dateField, fieldsOf, leafOf, mergeSameField, negate, numberField, pickField } from './procedural'
import type { CmdNlField } from './schema'
import { cmdNlField } from './schema'
import type { Body, FieldT, R, ValT } from './grammarCore'
import { F, fieldT, fit, isDateKind, r, ref, valT } from './grammarCore'
import { EDIT_RULES, addEditTerminals } from './grammarEdit'
import { EXTRA_RULES, addExtraTerminals } from './grammarExtra'
import {
  AGG_WORDS,
  AGG_WORDS_EXTRA,
  DATE_ONLY_AGG,
  PERCENT_AGG_WORDS,
  SHARE_WORDS,
  SORT_SUPERLATIVES,
} from './vocab/aggregations'
import type { StatAgg } from './vocab/aggregations'
import { CMP_PHRASES, NEGATIONS, TRAILING_CMP } from './vocab/comparators'
import { DATE_DAY_WORDS, DATE_NOUNS, DATE_TRIGGER_WORDS, MONTHS, WEEKDAY_NAMES } from './vocab/dates'
import { CONJUNCTIONS, GLUE_WORDS, LEAD_FILLERS } from './vocab/fillers'
import {
  CHECKBOX_ANTONYMS,
  FINAL_OPTIONS,
  MEMBER_CUES,
  ME_WORDS,
  OPEN_WORDS,
  OVERDUE_WORDS,
  QUANTITY_NOUNS,
  SUPERLATIVE_FIELD_HINTS,
} from './vocab/hints'
import { possessive, singular } from './vocab/inflect'
import { GROUP_VERBS, LIMIT_WORDS, PER_WORDS, SORT_DIRECTIONS, SORT_PHRASES, SORT_VERBS } from './vocab/verbs'

/**
 * The Cmd+K grammar for the chart parser: a lattice of typed terminals built from the tokens
 * (lexicon, extractors, vocabulary), and weighted rules whose actions build IR fragments.
 * Edits, fills and creates live in grammarEdit.ts.
 */

interface SortT {
  cue?: boolean
  field?: FieldT
  dir?: 'asc' | 'desc'
  limit?: number
  /** A field-less superlative's word ("newest" → a date field), or 'alpha' for A–Z. */
  hint?: string
}

/** A superlative terminal: its direction and the word, for picking a field when none is named. */
interface SuperT {
  dir: 'asc' | 'desc'
  hint: string
}

/* ------------------------------------------------------------------------------------ lattice */

const DATE_TRIGGERS = new Set([...Object.keys(DATE_DAY_WORDS), ...Object.keys(WEEKDAY_NAMES), ...DATE_TRIGGER_WORDS])
/** Superlatives that name a field kind but not a direction in SORT_SUPERLATIVES. */
const SUPER_DIRS: Record<string, 'asc' | 'desc'> = { cheapest: 'asc', soonest: 'asc', priciest: 'desc', costliest: 'desc' }
const ALPHA_WORDS = new Set(['a', 'z', 'a-z', 'z-a', 'alphabetical', 'alphabetically'])
/** Bare verbs that are edits, not member cues ("assign to me" assigns; "assigned to me" filters). */
const EDIT_NOT_CUE = new Set(['assign', 'reassign', 'give'])
const FINAL_STATE_WORDS = new Set([...FINAL_OPTIONS, 'ended', 'over'])
const BOOL_TRUE = /^(true|yes|checked|ticked|done|on|1)$/
const BOOL_FALSE = /^(false|no|unchecked|unticked|off|0)$/
const NEG_EMPTY = new Set(['without', 'no', 'missing', 'lacking'])
const BETWEEN_SEPS = new Set(['and', 'to', '-', 'through', 'thru', 'till', 'until'])
const ANTONYM_FIRST = new Set(['active', 'current', 'enabled', 'visible', 'live'])

const isDateish = (word: string) => DATE_TRIGGERS.has(word) || MONTHS.includes(word.slice(0, 3))

/** "active" with an Archived checkbox → not archived; "open" with a Done option → status isn't done. */
function stateCond(ctx: CmdNlCtx, w: string): Cond | undefined {
  const byCheckbox = () => {
    const antonyms = CHECKBOX_ANTONYMS[w] ?? []
    const box = fieldsOf(ctx, ['checkbox']).find((f) =>
      f.title
        .toLowerCase()
        .split(/\s+/)
        .some((t) => antonyms.includes(t)),
    )
    return box ? leafOf(box, 'notchecked', undefined, 'implicit') : undefined
  }
  const bySelect = () => {
    if (!OPEN_WORDS.has(w)) return
    for (const select of fieldsOf(ctx, ['select'])) {
      const finals = (select.options ?? []).filter((o) => FINAL_OPTIONS.has(o.toLowerCase()))
      if (!finals.length || finals.length === select.options?.length) continue
      return finals.length === 1 ? leafOf(select, 'neq', finals[0]!, 'implicit') : leafOf(select, 'nanyof', finals, 'implicit')
    }
  }
  return ANTONYM_FIRST.has(w) ? byCheckbox() ?? bySelect() : bySelect() ?? byCheckbox()
}

/** "closed deals": the select field's final options (Won, Lost), when the word isn't an option itself. */
function finalCond(ctx: CmdNlCtx, w: string): Cond | undefined {
  for (const select of fieldsOf(ctx, ['select'])) {
    const options = select.options ?? []
    if (options.some((o) => o.toLowerCase() === w)) return
    const finals = options.filter((o) => FINAL_OPTIONS.has(o.toLowerCase()))
    if (!finals.length || finals.length === options.length) continue
    return finals.length === 1 ? leafOf(select, 'eq', finals[0]!, 'implicit') : leafOf(select, 'anyof', finals, 'implicit')
  }
}

/** "unsigned", "unassigned": a checkbox or user field by its stem, never by a typo match. */
function unField(ctx: CmdNlCtx, w: string): { fieldId: string; cmp: CmdNlCmp } | undefined {
  if (w.length <= 4 || !w.startsWith('un')) return
  const rest = w.slice(2)
  const stemHit = (f: CmdNlField) =>
    f.title
      .toLowerCase()
      .split(/\s+/)
      .some((t) => (cmdNlWordMatch(rest, t)?.score ?? 0) >= 0.85)
  const target =
    (/^assign|^own/.test(rest) ? pickField(fieldsOf(ctx, ['user']), [rest]) : undefined) ??
    ctx.schema.fields.find((f) => (f.kind === 'checkbox' || f.kind === 'user') && stemHit(f))
  return target ? { fieldId: target.id, cmp: target.kind === 'checkbox' ? 'notchecked' : 'blank' } : undefined
}

/** Leading openers ("what is the", "show me") count as glue; elsewhere "me" is a value. */
function leadingFillers(words: string[]) {
  let i = 0
  for (let opener = LEAD_FILLERS.find((p) => p.every((w, k) => words[i + k] === w)); opener; ) {
    i += opener.length
    opener = LEAD_FILLERS.find((p) => p.every((w, k) => words[i + k] === w))
  }
  return i
}

export interface CmdNlLattice {
  edges: ChartEdge[]
  skippable: (i: number) => boolean
}

export function buildCmdNlLattice(ctx: CmdNlCtx): CmdNlLattice {
  const { tokens, lex, schema, now } = ctx
  const words = cmdNlWordList(tokens)
  const edges: ChartEdge[] = []
  const add = (cat: string, start: number, end: number, value: unknown = null, score = 1) =>
    edges.push({ cat, start, end, value, score })

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const w = words[i]!

    for (const m of cmdNlLexAt(lex, words, i)) {
      if (m.entry.kind === 'field') {
        const field = cmdNlField(schema, m.entry.fieldId)
        if (!field) continue
        const via: FieldRef['via'] = m.via === 'fuzzy' ? 'fuzzy' : m.entry.quality < 1 || m.via !== 'exact' ? 'synonym' : 'title'
        const value: FieldT = { fieldId: field.id, via, words: words.slice(i, m.end) }
        add('FIELD', i, m.end, value, m.score)
        // "close date", "due date": a date noun after a date field belongs to it.
        if ((field.kind === 'date' || field.kind === 'datetime') && DATE_NOUNS.has(words[m.end] ?? '')) {
          add('FIELD', i, m.end + 1, value, m.score)
        }
      } else if (m.entry.kind === 'value') {
        add('OPT', i, m.end, { t: 'opt', fieldId: m.entry.fieldId, value: m.entry.value! }, m.score)
      } else {
        add('MEMBER', i, m.end, { t: 'member', fieldId: m.entry.fieldId, member: m.entry.value! }, m.score)
      }
    }

    if (t.quoted) add('QUOTED', i, i + 1, { t: 'quoted', text: t.text })
    if (!CONJUNCTIONS[w] && !['(', ')', ','].includes(w)) add('TEXTW', i, i + 1, t.text, 0.8)

    const num = numberAt(tokens, i)
    // "+50" is a change, never a value to filter on.
    if (num && !t.text.startsWith('+'))
      add('NUM', i, num.end, num.percent ? { t: 'num', value: num.value, percent: true } : { t: 'num', value: num.value })
    if (!/^[a-z]/.test(w) || isDateish(w)) {
      const date = weekdayAt(tokens, i, now) ?? dateAt(tokens, i, now)
      if (date) add('DATE', i, date.end, { t: 'date', value: date.value })
    }
    const win = windowAt(tokens, i)
    if (win) add('WINDOW', i, win.end, win.value)
    if (BOOL_TRUE.test(w)) add('BOOL', i, i + 1, { t: 'bool', value: true })
    if (BOOL_FALSE.test(w)) add('BOOL', i, i + 1, { t: 'bool', value: false })
    if (ME_WORDS.has(w)) add('ME', i, i + 1, { t: 'me' })
    if (w === 'my' || w === 'mine') add('MY', i, i + 1)

    const cmp = phraseAt(words, i, CMP_PHRASES, true)
    if (cmp) add('CMP', i, cmp.end, cmp.value, cmp.score)
    const trail = phraseAt(words, i, TRAILING_CMP)
    if (trail) add('TRAIL', i, trail.end, trail.value)
    if (NEGATIONS.has(w)) add('NEG', i, i + 1)
    if (NEG_EMPTY.has(w)) add('NEGW', i, i + 1)
    if (CONJUNCTIONS[w] === 'and' || w === 'but') add('AND', i, i + 1)
    // "won vs lost" is first a comparison (grammarExtra); as a plain "or" it ranks lower.
    if (CONJUNCTIONS[w] === 'or') add('OR', i, i + 1, null, w === 'vs' || w === 'versus' ? 0.7 : 1)
    if (w === ',') add('COMMA', i, i + 1)
    if (w === '(') add('LP', i, i + 1)
    if (w === ')') add('RP', i, i + 1)
    if (BETWEEN_SEPS.has(w)) add('SEP', i, i + 1)

    const overdue = phraseAt(words, i, OVERDUE_WORDS)
    if (overdue) add('OVERDUE', i, overdue.end)
    if (MEMBER_CUES.has(w) && !EDIT_NOT_CUE.has(w)) add('CUE', i, i + 1, w)
    if (w === 'by') add('BY', i, i + 1)
    const owner = possessive(w)
    if (owner) {
      for (const user of fieldsOf(ctx, ['user'])) {
        const m = cmdNlLexAt(lex, [owner], 0, ['member']).find((x) => x.entry.fieldId === user.id)
        if (m) add('POSS', i, i + 1, { fieldId: user.id, member: m.entry.value! }, m.score)
      }
      // "partner's share of revenue": a value in the possessive is still that value.
      for (const m of cmdNlLexAt(lex, [owner], 0, ['value'])) {
        if (m.end === 1) add('OPT', i, i + 1, { t: 'opt', fieldId: m.entry.fieldId, value: m.entry.value! }, m.score * 0.95)
      }
    }
    if (OPEN_WORDS.has(w) || CHECKBOX_ANTONYMS[w]) {
      const state = stateCond(ctx, w)
      if (state) add('STATE', i, i + 1, state, 0.8)
    }
    if (FINAL_STATE_WORDS.has(w)) {
      const final = finalCond(ctx, w)
      if (final) add('STATE', i, i + 1, final, 0.8)
    }
    const un = unField(ctx, w)
    if (un) add('UNF', i, i + 1, un, 0.9)
    if (lex.tableNouns.has(w)) add('TNOUN', i, i + 1)

    // Stats
    const agg = phraseAt(words, i, [...AGG_WORDS_EXTRA, ...AGG_WORDS])
    if (agg) add('AGG', i, agg.end, agg.value)
    // "percent of …", "what % of …"; never the % of a number ("10 %", "10 percent").
    const inNumber = i > 0 && (numberAt(tokens, i - 1)?.end ?? 0) > i
    const share = inNumber ? undefined : phraseAt(words, i, SHARE_WORDS)
    if (share) add('SHARE', i, share.end)
    const pagg = inNumber ? undefined : phraseAt(words, i, PERCENT_AGG_WORDS)
    if (pagg) add('PAGG', i, pagg.end, pagg.value)
    if (w === 'from') add('FROMW', i, i + 1)
    if (DATE_ONLY_AGG[w]) add('DAGG', i, i + 1, DATE_ONLY_AGG[w])
    if (PER_WORDS.has(w)) add('PER', i, i + 1)

    // Sort and group
    if (GROUP_VERBS.has(w)) add('GROUPV', i, i + 1)
    if (SORT_VERBS.has(w)) add('SORTV', i, i + 1)
    if (SORT_DIRECTIONS[w]) {
      add('DIR', i, i + 1, SORT_DIRECTIONS[w])
      if (words[i + 1] === 'order') add('DIR', i, i + 2, SORT_DIRECTIONS[w])
    }
    const sortPhrase = phraseAt(words, i, SORT_PHRASES)
    // "a to z", "z-a": an alphabetical sort, so the display text field rather than a number.
    if (sortPhrase) add(ALPHA_WORDS.has(w) ? 'ALPHA' : 'SORTPH', i, sortPhrase.end, sortPhrase.value)
    else if (w === 'a-z' || w === 'z-a') add('ALPHA', i, i + 1, w === 'a-z' ? 'asc' : 'desc')
    else if (w === 'alphabetical' || w === 'alphabetically') add('ALPHA', i, i + 1, 'asc')
    const limitNum = LIMIT_WORDS.has(w) ? numberAt(tokens, i + 1) : undefined
    if (limitNum) add('LIMITN', i, limitNum.end, { limit: limitNum.value, dir: w === 'bottom' ? 'asc' : 'desc' })
    // "5 biggest deals" opens the query; "qty under 10 lowest first" is a condition, then a direction.
    if (
      num &&
      SORT_SUPERLATIVES[words[num.end] ?? ''] &&
      (i === 0 || LIMIT_WORDS.has(words[i - 1]!)) &&
      words[num.end + 1] !== 'first'
    ) {
      add('SUPN', i, num.end + 1, { limit: num.value, dir: SORT_SUPERLATIVES[words[num.end]!], hint: words[num.end] })
    }
    const superDir = SORT_SUPERLATIVES[w] ?? SUPER_DIRS[w]
    if (superDir) {
      const sup: SuperT = { dir: superDir, hint: w }
      const next = words[i + 1] ?? ''
      if (next === 'first') add('SUPER', i, i + 2, sup)
      else if (words[i + 2] === 'first' || (i === 0 && lex.tableNouns.has(next))) add('SUPER', i, i + 1, sup)
      // Anywhere else ("most expensive", "cheapest 5") it is weaker: "highest amount" is first a stat.
      else add('SUPW', i, i + 1, sup, 0.85)
    }
    if (w === 'first') add('FIRSTW', i, i + 1)
  }

  addEditTerminals(ctx, words, add)
  addExtraTerminals(ctx, words, add)

  const lead = leadingFillers(words)
  const skip = words.map((w, i) => i < lead || GLUE_WORDS.has(w) || lex.tableNouns.has(w))
  return { edges, skippable: (i) => !!skip[i] }
}

/* ---------------------------------------------------------------------------- semantic helpers */

/**
 * A calendar period ("this quarter", "sep 2026") compared with a date field: "in it" is between its
 * first and last day; before/after compare with its start or end.
 */
function periodCond(field: CmdNlField, cmp: CmdNlCmp, range: [string, string], via: FieldRef['via']): Cond | undefined {
  const [from, to] = range.map((date): Scalar => ({ date, precision: 'day' })) as [Scalar, Scalar]
  switch (cmp) {
    case 'eq':
    case 'anyof':
    case 'like':
      return leafOf(field, 'between', [from, to], via)
    case 'neq':
    case 'nanyof':
    case 'nlike':
      return negate(leafOf(field, 'between', [from, to], via))
    case 'gt':
      return leafOf(field, 'gt', to, via)
    case 'gte':
      return leafOf(field, 'gte', from, via)
    case 'lt':
      return leafOf(field, 'lt', from, via)
    case 'lte':
      return leafOf(field, 'lte', to, via)
  }
}

const rangeOf = (v: ValT) =>
  v.t === 'date' && typeof v.value === 'object' && v.value && 'range' in v.value ? v.value.range : undefined

/** "<field> <cmp> <value>", shaped by the comparator; undefined when the types don't fit. */
function compare(field: CmdNlField, cmp: CmdNlCmp, v: ValT, via: FieldRef['via']): Cond | undefined {
  if (['blank', 'notblank', 'checked', 'notchecked', 'within', 'between'].includes(cmp)) return
  if (field.kind === 'checkbox') {
    if (v.t !== 'bool' || (cmp !== 'eq' && cmp !== 'neq')) return
    return leafOf(field, v.value === (cmp === 'eq') ? 'checked' : 'notchecked', undefined, via)
  }
  const range = rangeOf(v)
  if (range) return isDateKind(field) ? periodCond(field, cmp, range, via) : undefined
  const value = fit(field, v)
  if (value === undefined) return
  if (cmp === 'like' || cmp === 'nlike') {
    if (field.kind === 'select' || field.kind === 'multiselect' || field.kind === 'user')
      return leafOf(field, cmp === 'like' ? 'anyof' : 'nanyof', value, via)
    if (field.kind !== 'text' && field.kind !== 'other') return
    return leafOf(field, cmp, value, via)
  }
  if (cmp === 'anyof' || cmp === 'nanyof') {
    if (field.kind === 'user') return leafOf(field, cmp, value, via)
    return leafOf(field, cmp, Array.isArray(value) ? value : [value], via)
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(cmp) && field.kind !== 'number' && !isDateKind(field)) return
  return leafOf(field, cmp, value, via)
}

function lastLeaf(cond: Cond): CondLeaf | undefined {
  if (isCondLeaf(cond)) return cond
  if (cond.op === 'not') return
  return lastLeaf(cond.args[cond.args.length - 1]!)
}

const orOf = (a: Cond, b: Cond): Cond => ({
  op: 'or',
  args: [...(!isCondLeaf(a) && a.op === 'or' ? a.args : [a]), ...(!isCondLeaf(b) && b.op === 'or' ? b.args : [b])],
})

/**
 * "stage is won or lost": a bare value after `or` continues the last leaf's field. Negated, it is one
 * exclusion list: "stage isn't won or lost" is none of [Won, Lost], not "≠ Won or ≠ Lost".
 */
function continueOr(ctx: CmdNlCtx, cond: Cond, v: ValT | string): Cond | undefined {
  const prev = lastLeaf(cond)
  if (!prev || ['blank', 'notblank', 'checked', 'notchecked', 'between', 'within'].includes(prev.cmp)) return
  const field = cmdNlField(ctx.schema, prev.field.id)
  if (!field) return
  const next =
    typeof v === 'string'
      ? field.kind === 'text' && /^[\p{L}\p{N}]/u.test(v)
        ? leafOf(field, prev.cmp, v, prev.field.via)
        : undefined
      : compare(field, prev.cmp, v, prev.field.via)
  if (!next) return
  const negative = prev.cmp === 'neq' || prev.cmp === 'nanyof'
  if (negative && cond === prev && isCondLeaf(next) && (field.kind === 'select' || field.kind === 'multiselect')) {
    const listOf = (leaf: CondLeaf) => (Array.isArray(leaf.value) ? leaf.value : leaf.value === undefined ? [] : [leaf.value])
    const values = [...new Set([...listOf(prev), ...listOf(next)].map((x) => x as Scalar))]
    return leafOf(field, 'nanyof', values, prev.field.via)
  }
  return orOf(cond, next)
}

function statBody(
  ctx: CmdNlCtx,
  agg: StatAgg,
  target: FieldT | undefined,
  where: Cond | undefined,
  per?: FieldT,
  dateOnly = false,
): Body | undefined {
  if (agg === 'mode') return
  const field = target ? F(ctx, target) : undefined
  if (target && !field) return
  if (dateOnly && (!field || !isDateKind(field))) return
  // "how many hardware units": counting a quantity means adding it up.
  const quantity = agg === 'count' && field?.kind === 'number' && !!target && target.words.every((w) => QUANTITY_NOUNS.has(w))
  // "how many suppliers", "number of cities": counting a field's things (plural) counts its distinct values.
  const lastWord = target?.words[target.words.length - 1] ?? ''
  const distinct =
    agg === 'count' &&
    !!field &&
    field.kind !== 'number' &&
    !!lastWord &&
    singular(lastWord) !== lastWord &&
    field.aggregations.includes('count_unique')
  const fn = distinct ? 'count_unique' : aggFor(quantity ? 'sum' : agg, field)
  if (!fn) return
  const groupBy = per ? [ref(per.fieldId, per.via)] : undefined
  if (per && per.fieldId === target?.fieldId) return
  return {
    intent: 'stat',
    scope: where ? 'where' : 'view',
    where,
    aggs: [{ fn, field: target ? ref(target.fieldId, target.via) : undefined }],
    groupBy,
  }
}

const FOOTER_PERCENT: Partial<Record<CmdNlCmp, string>> = {
  checked: 'percent_checked',
  notchecked: 'percent_unchecked',
  blank: 'percent_empty',
  notblank: 'percent_filled',
}

/**
 * A share of the total: of a number field's sum, or of the record count when no field is named.
 * One share needs its condition; a share per group ("percent of revenue by stage") takes none.
 */
function shareBody(ctx: CmdNlCtx, target: FieldT | undefined, where: Cond | undefined, per?: FieldT): Body | undefined {
  const field = target ? F(ctx, target) : undefined
  if (target && (field?.kind !== 'number' || !field.aggregations.includes('sum'))) return
  if (per ? where : !where) return
  if (per && per.fieldId === target?.fieldId) return
  // "% signed", "percent without owner": the footer already has that figure (percent_checked, percent_empty).
  if (!target && where && isCondLeaf(where)) {
    const fn = FOOTER_PERCENT[where.cmp]
    const leafField = cmdNlField(ctx.schema, where.field.id)
    if (fn && leafField?.aggregations.includes(fn)) {
      return { intent: 'stat', scope: 'view', aggs: [{ fn, field: ref(leafField.id, where.field.via) }] }
    }
  }
  return {
    intent: 'stat',
    scope: where ? 'where' : 'view',
    where,
    aggs: [
      target ? { fn: CMD_NL_SHARE, base: 'sum', field: ref(target.fieldId, target.via) } : { fn: CMD_NL_SHARE, base: 'count' },
    ],
    groupBy: per ? [ref(per.fieldId, per.via)] : undefined,
  }
}

/** The footer's own percentages ("percent empty of city"), when the field offers them. */
function percentAggBody(ctx: CmdNlCtx, fn: string, target: FieldT, where: Cond | undefined): Body | undefined {
  const field = F(ctx, target)
  if (!field?.aggregations.includes(fn)) return
  return { intent: 'stat', scope: where ? 'where' : 'view', where, aggs: [{ fn, field: ref(target.fieldId, target.via) }] }
}

function mergeSort(a: SortT, b: SortT): SortT | undefined {
  if ((a.field && b.field) || (a.dir && b.dir && a.dir !== b.dir) || (a.limit !== undefined && b.limit !== undefined)) return
  return {
    cue: a.cue || b.cue,
    field: a.field ?? b.field,
    dir: a.dir ?? b.dir,
    limit: a.limit ?? b.limit,
    hint: a.hint ?? b.hint,
  }
}

/** The field a superlative or A–Z sort means when none is named ("newest" → a date, "a to z" → the title). */
function hintedSortField(ctx: CmdNlCtx, hint: string | undefined): CmdNlField | undefined {
  if (!hint) return
  if (hint === 'alpha') {
    return ctx.schema.fields.find((f) => f.pv && (f.kind === 'text' || f.kind === 'other')) ?? fieldsOf(ctx, ['text'])[0]
  }
  const byKind = SUPERLATIVE_FIELD_HINTS[hint]
  if (!byKind) return
  return pickField(fieldsOf(ctx, byKind.kind === 'date' ? ['date', 'datetime'] : ['number']), byKind.hints)
}

function sortBody(ctx: CmdNlCtx, s: SortT, where: Cond | undefined): Body | ChartScaled | undefined {
  if (!s.cue) return
  if (s.limit !== undefined && (!Number.isInteger(s.limit) || s.limit < 1)) return
  let field = s.field ? ref(s.field.fieldId, s.field.via) : undefined
  let factor = 1
  if (!field) {
    // No field named: what the superlative implies, else the number field the condition uses, else the main one.
    const condField = condLeaves(where)
      .map((l) => cmdNlField(ctx.schema, l.field.id))
      .find((f) => f?.kind === 'number')
    const implicit = hintedSortField(ctx, s.hint) ?? condField ?? numberField(ctx)
    if (!implicit) return
    field = ref(implicit.id, 'implicit')
    factor = 0.85
  }
  const body: Body = {
    intent: 'sort',
    scope: where ? 'where' : 'view',
    where,
    orderBy: [{ field, dir: s.dir ?? 'asc' }],
    limit: s.limit,
  }
  return factor < 1 ? new ChartScaled(body, factor) : body
}

const groupBody = (f: FieldT, where?: Cond): Body => ({
  intent: 'group',
  scope: where ? 'where' : 'view',
  where,
  groupBy: [ref(f.fieldId, f.via)],
})

/* ------------------------------------------------------------------------------------- rules */

const cond = (k: unknown) => k as Cond

const RULES: R[] = [
  r('S', 'Q', 1),
  r('Q', 'Filter', 1),
  r('Q', 'Stat', 1),
  r('Q', 'Sort', 1),
  r('Q', 'Group', 1),
  r('Q', 'Edit', 1),

  /* ----------------------------------------------------------------------- filters / conditions */
  r('Filter', 'Expr', 1, (k) => ({ intent: 'filter', scope: 'where', where: cond(k[0]) } satisfies Body)),

  r('Expr', 'And', 1),
  r('Expr', 'Expr OR And', 0.95, (k) => orOf(cond(k[0]), cond(k[2]))),

  r('And', 'Atom', 1),
  r('And', 'And AND Atom', 1, (k) => mergeSameField([cond(k[0]), cond(k[2])])),
  r('And', 'And COMMA Atom', 1, (k) => mergeSameField([cond(k[0]), cond(k[2])])),
  r('And', 'And Atom', 0.99, (k) => mergeSameField([cond(k[0]), cond(k[1])])),

  r('Atom', 'Cond', 1),
  r('Atom', 'LP Expr RP', 1, (k) => k[1]),
  r('Atom', 'NEG Atom', 1, (k) => negate(cond(k[1]))),
  r('Atom', 'OrVals', 1),

  // "stage is won or lost", "city is austin or boston"
  r('OrVals', 'Cond OR Val', 1, (k, ctx) => continueOr(ctx, cond(k[0]), valT(k[2]))),
  r('OrVals', 'Cond OR TEXTW', 0.8, (k, ctx) => continueOr(ctx, cond(k[0]), k[2] as string)),
  r('OrVals', 'OrVals OR Val', 1, (k, ctx) => continueOr(ctx, cond(k[0]), valT(k[2]))),
  r('OrVals', 'OrVals COMMA Val', 1, (k, ctx) => continueOr(ctx, cond(k[0]), valT(k[2]))),

  r('Val', 'NUM', 1),
  r('Val', 'DATE', 1),
  r('Val', 'OPT', 1),
  r('Val', 'MEMBER', 1),
  r('Val', 'ME', 1),
  r('Val', 'BOOL', 1),
  r('Val', 'QUOTED', 1),

  r('List', 'Val ListSep Val', 1, (k) => [k[0], k[2]]),
  r('List', 'List ListSep Val', 1, (k) => [...(k[0] as ValT[]), k[2]]),
  r('ListSep', 'COMMA', 1),
  r('ListSep', 'OR', 1),
  r('ListSep', 'AND', 1),

  r('TextRun', 'TEXTW', 1),
  r('TextRun', 'TextRun TEXTW', 1, (k) => `${k[0] as string} ${k[1] as string}`),

  // A checkbox on its own is "checked": "signed deals".
  r('Cond', 'FIELD', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    return f?.kind === 'checkbox' ? leafOf(f, 'checked', undefined, fieldT(k[0]).via) : undefined
  }),
  r('Cond', 'FIELD Val', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const v = valT(k[1])
    if (!f) return
    if (f.kind === 'checkbox')
      return v.t === 'bool' ? leafOf(f, v.value ? 'checked' : 'notchecked', undefined, fieldT(k[0]).via) : undefined
    const range = rangeOf(v)
    if (range) return isDateKind(f) ? periodCond(f, 'eq', range, fieldT(k[0]).via) : undefined
    const value = fit(f, v)
    return value === undefined ? undefined : leafOf(f, 'eq', value, fieldT(k[0]).via)
  }),
  // A bare period ("this qtr", "sep 2026") on the table's main date field.
  r('Cond', 'DATE', 0.8, (k, ctx) => {
    const range = rangeOf(valT(k[0]))
    const date = dateField(ctx)
    return range && date ? periodCond(date, 'eq', range, 'implicit') : undefined
  }),
  // "referred by partner", "owned by ann"
  r('Cond', 'FIELD BY Val', 0.95, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const value = f && f.kind !== 'checkbox' ? fit(f, valT(k[2])) : undefined
    return f && value !== undefined ? leafOf(f, 'eq', value, fieldT(k[0]).via) : undefined
  }),
  r('Cond', 'FIELD CMP Val', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    return f ? compare(f, k[1] as CmdNlCmp, valT(k[2]), fieldT(k[0]).via) : undefined
  }),
  r('Cond', 'FIELD CMP', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const cmp = k[1] as CmdNlCmp
    if (!f) return
    if (cmp === 'blank' || cmp === 'notblank') return leafOf(f, cmp, undefined, fieldT(k[0]).via)
    if ((cmp === 'checked' || cmp === 'notchecked') && f.kind === 'checkbox') return leafOf(f, cmp, undefined, fieldT(k[0]).via)
  }),
  r('Cond', 'FIELD CMP TextRun', 0.9, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const cmp = k[1] as CmdNlCmp
    if (!f || (f.kind !== 'text' && f.kind !== 'other') || !['eq', 'neq', 'like', 'nlike'].includes(cmp)) return
    return leafOf(f, cmp, k[2] as string, fieldT(k[0]).via)
  }),
  r('Cond', 'FIELD CMP List', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const cmp = k[1] as CmdNlCmp
    if (!f || !['anyof', 'nanyof', 'eq', 'neq'].includes(cmp)) return
    const values = (k[2] as ValT[]).map((v) => fit(f, v))
    if (values.includes(undefined)) return
    const flat = values.flatMap((v) => (Array.isArray(v) ? v : [v as Scalar]))
    return leafOf(f, cmp === 'eq' || cmp === 'anyof' ? 'anyof' : 'nanyof', flat, fieldT(k[0]).via)
  }),
  r('Cond', 'FIELD WINDOW', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    return f && isDateKind(f) ? leafOf(f, 'within', k[1] as Scalar, fieldT(k[0]).via) : undefined
  }),
  r('Cond', 'FIELD CMP WINDOW', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const cmp = k[1] as CmdNlCmp
    if (!f || !isDateKind(f) || !['within', 'eq', 'anyof'].includes(cmp)) return
    return leafOf(f, 'within', k[2] as Scalar, fieldT(k[0]).via)
  }),
  r('Cond', 'FIELD CMP Val SEP Val', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    if (!f || k[1] !== 'between' || (f.kind !== 'number' && !isDateKind(f))) return
    const a = fit(f, valT(k[2]))
    const b = fit(f, valT(k[4]))
    return a === undefined || b === undefined ? undefined : leafOf(f, 'between', [a as Scalar, b as Scalar], fieldT(k[0]).via)
  }),
  r('Cond', 'FIELD Val TRAIL', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const v = valT(k[1])
    return f?.kind === 'number' && v.t === 'num' ? leafOf(f, k[2] as CmdNlCmp, v.value, fieldT(k[0]).via) : undefined
  }),
  // "stage not lost", "archived not checked"
  r('Cond', 'FIELD NEG Val', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const inner = f ? compare(f, 'eq', valT(k[2]), fieldT(k[0]).via) : undefined
    return inner ? negate(inner) : undefined
  }),
  r('Cond', 'FIELD NEG CMP Val', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const inner = f ? compare(f, k[2] as CmdNlCmp, valT(k[3]), fieldT(k[0]).via) : undefined
    return inner ? negate(inner) : undefined
  }),
  r('Cond', 'FIELD NEG CMP', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[0]))
    const cmp = k[2] as CmdNlCmp
    if (!f) return
    if (cmp === 'blank' || cmp === 'notblank') return negate(leafOf(f, cmp, undefined, fieldT(k[0]).via))
    if ((cmp === 'checked' || cmp === 'notchecked') && f.kind === 'checkbox')
      return negate(leafOf(f, cmp, undefined, fieldT(k[0]).via))
  }),
  // "without owner", "no due date"
  r('Cond', 'NEGW FIELD', 1, (k, ctx) => {
    const f = F(ctx, fieldT(k[1]))
    return f ? leafOf(f, f.kind === 'checkbox' ? 'notchecked' : 'blank', undefined, fieldT(k[1]).via) : undefined
  }),
  // Value-linked: "won deals", "urgent", "austin", "for anbarasu".
  r('Cond', 'OPT', 0.9, (k, ctx) => {
    const v = k[0] as ValT & { t: 'opt' }
    const f = cmdNlField(ctx.schema, v.fieldId)
    return f ? leafOf(f, 'eq', f.kind === 'multiselect' ? [v.value] : v.value, 'value') : undefined
  }),
  r('Cond', 'MEMBER', 0.9, (k, ctx) => {
    const v = k[0] as ValT & { t: 'member' }
    const f = cmdNlField(ctx.schema, v.fieldId)
    return f ? leafOf(f, 'anyof', { member: v.member }, 'value') : undefined
  }),
  // "owned by ann", "assigned to me"
  r('Cond', 'CUE Val', 0.95, (k, ctx) => cueCond(ctx, k[0] as string, valT(k[1]))),
  r('Cond', 'CUE BY Val', 0.95, (k, ctx) => cueCond(ctx, k[0] as string, valT(k[2]))),
  // "ann's deals", "my tasks"
  r('Cond', 'POSS', 0.9, (k, ctx) => {
    const v = k[0] as { fieldId: string; member: string }
    const f = cmdNlField(ctx.schema, v.fieldId)
    return f ? leafOf(f, 'anyof', { member: v.member }, 'implicit') : undefined
  }),
  r('Cond', 'MY', 0.9, (_k, ctx) => {
    const user = pickField(fieldsOf(ctx, ['user']), ['owner', 'assignee'])
    return user ? leafOf(user, 'anyof', { me: true }, 'implicit') : undefined
  }),
  r('Cond', 'OVERDUE', 0.85, (_k, ctx) => {
    const due = dateField(ctx)
    return due ? leafOf(due, 'lt', { relative: 'today' }, 'implicit') : undefined
  }),
  // A window or comparison with no field: "next week", "over 10k", "before oct 1".
  r('Cond', 'WINDOW', 0.8, (k, ctx) => {
    const date = dateField(ctx)
    return date ? leafOf(date, 'within', k[0] as Scalar, 'implicit') : undefined
  }),
  // Dates only: a bare number's field is guessed by grammarExtra's NUMF, which records the guess.
  r('Cond', 'CMP Val', 0.8, (k, ctx) => {
    const cmp = k[0] as CmdNlCmp
    const v = valT(k[1])
    if (!['gt', 'gte', 'lt', 'lte'].includes(cmp)) return
    const implicit = v.t === 'date' ? dateField(ctx) : undefined
    return implicit ? compare(implicit, cmp, v, 'implicit') : undefined
  }),
  // "deals between 1000 and 5000"
  r('Cond', 'CMP Val SEP Val', 0.8, (k, ctx) => {
    const a = valT(k[1])
    const b = valT(k[3])
    if (k[0] !== 'between' || a.t !== b.t) return
    const implicit = a.t === 'date' ? dateField(ctx) : a.t === 'num' ? numberField(ctx) : undefined
    const va = implicit ? fit(implicit, a) : undefined
    const vb = implicit ? fit(implicit, b) : undefined
    return implicit && va !== undefined && vb !== undefined
      ? leafOf(implicit, 'between', [va as Scalar, vb as Scalar], 'implicit')
      : undefined
  }),
  r('Cond', 'STATE', 1),
  r('Cond', 'UNF', 1, (k, ctx) => {
    const v = k[0] as { fieldId: string; cmp: CmdNlCmp }
    const f = cmdNlField(ctx.schema, v.fieldId)
    return f ? leafOf(f, v.cmp, undefined, 'synonym') : undefined
  }),

  /* ------------------------------------------------------------------------------------- stats */
  r('Stat', 'AGG', 1, (k, ctx) => (k[0] === 'count' ? statBody(ctx, 'count', undefined, undefined) : undefined)),
  r('Stat', 'AGG FIELD', 1, (k, ctx) => statBody(ctx, k[0] as StatAgg, fieldT(k[1]), undefined)),
  r('Stat', 'AGG FIELD Expr', 1, (k, ctx) => statBody(ctx, k[0] as StatAgg, fieldT(k[1]), cond(k[2]))),
  r('Stat', 'AGG Expr FIELD', 0.97, (k, ctx) => statBody(ctx, k[0] as StatAgg, fieldT(k[2]), cond(k[1]))),
  r('Stat', 'AGG Expr', 1, (k, ctx) => (k[0] === 'count' ? statBody(ctx, 'count', undefined, cond(k[1])) : undefined)),
  // "won or lost count", "won vs lost count"
  r('Stat', 'Expr AGG', 0.97, (k, ctx) => (k[1] === 'count' ? statBody(ctx, 'count', undefined, cond(k[0])) : undefined)),
  r('Stat', 'AGG FIELD PER FIELD', 1, (k, ctx) => statBody(ctx, k[0] as StatAgg, fieldT(k[1]), undefined, fieldT(k[3]))),
  r('Stat', 'AGG PER FIELD', 1, (k, ctx) =>
    k[0] === 'count' ? statBody(ctx, 'count', undefined, undefined, fieldT(k[2])) : undefined,
  ),
  r('Stat', 'AGG Expr PER FIELD', 0.97, (k, ctx) =>
    k[0] === 'count' ? statBody(ctx, 'count', undefined, cond(k[1]), fieldT(k[3])) : undefined,
  ),
  // "amount total", "score average": the aggregation last.
  r('Stat', 'FIELD AGG', 1, (k, ctx) => (k[1] === 'count' ? undefined : statBody(ctx, k[1] as StatAgg, fieldT(k[0]), undefined))),
  // "estimate per status" adds the number up; "tasks per assignee" counts.
  r('Stat', 'FIELD PER FIELD', 0.95, (k, ctx) =>
    F(ctx, fieldT(k[0]))?.kind === 'number' ? statBody(ctx, 'sum', fieldT(k[0]), undefined, fieldT(k[2])) : undefined,
  ),
  r('Stat', 'TNOUN PER FIELD', 1, (k, ctx) => statBody(ctx, 'count', undefined, undefined, fieldT(k[2]))),
  // "first close date", "newest created": only before a date field.
  r('Stat', 'DAGG FIELD', 1, (k, ctx) => statBody(ctx, k[0] as StatAgg, fieldT(k[1]), undefined, undefined, true)),
  r('Stat', 'DAGG FIELD Expr', 1, (k, ctx) => statBody(ctx, k[0] as StatAgg, fieldT(k[1]), cond(k[2]), undefined, true)),

  // Shares: "percent of revenue where industry is tech", "partner's share of revenue", "% of tasks done".
  r('Stat', 'SHARE FIELD Expr', 1, (k, ctx) => shareBody(ctx, fieldT(k[1]), cond(k[2]))),
  r('Stat', 'SHARE FIELD FROMW Expr', 1, (k, ctx) => shareBody(ctx, fieldT(k[1]), cond(k[3]))),
  r('Stat', 'Expr SHARE FIELD', 0.97, (k, ctx) => shareBody(ctx, fieldT(k[2]), cond(k[0]))),
  r('Stat', 'SHARE Expr', 1, (k, ctx) => shareBody(ctx, undefined, cond(k[1]))),
  r('Stat', 'SHARE FROMW Expr', 1, (k, ctx) => shareBody(ctx, undefined, cond(k[2]))),
  r('Stat', 'Expr SHARE', 0.95, (k, ctx) => shareBody(ctx, undefined, cond(k[0]))),
  r('Stat', 'SHARE FIELD PER FIELD', 1, (k, ctx) => shareBody(ctx, fieldT(k[1]), undefined, fieldT(k[3]))),
  r('Stat', 'SHARE PER FIELD', 1, (k, ctx) => shareBody(ctx, undefined, undefined, fieldT(k[2]))),
  // The footer's percentages stay footer figures: "percent empty of city", "signed % checked".
  r('Stat', 'PAGG FIELD', 1, (k, ctx) => percentAggBody(ctx, k[0] as string, fieldT(k[1]), undefined)),
  r('Stat', 'PAGG FIELD Expr', 1, (k, ctx) => percentAggBody(ctx, k[0] as string, fieldT(k[1]), cond(k[2]))),
  r('Stat', 'FIELD PAGG', 1, (k, ctx) => percentAggBody(ctx, k[1] as string, fieldT(k[0]), undefined)),

  /* -------------------------------------------------------------------------------------- sort */
  r('Sort', 'SortSeq', 1, (k, ctx) => sortBody(ctx, k[0] as SortT, undefined)),
  r('Sort', 'Expr SortSeq', 1, (k, ctx) => sortBody(ctx, k[1] as SortT, cond(k[0]))),
  r('Sort', 'SortSeq Expr', 1, (k, ctx) => sortBody(ctx, k[0] as SortT, cond(k[1]))),
  r('Sort', 'SortSeq Expr SortSeq', 0.97, (k, ctx) => {
    const s = mergeSort(k[0] as SortT, k[2] as SortT)
    return s ? sortBody(ctx, s, cond(k[1])) : undefined
  }),
  r('Sort', 'Expr SortSeq Expr', 0.97, (k, ctx) => {
    const where = andConds([cond(k[0]), cond(k[2])])
    return sortBody(ctx, k[1] as SortT, where)
  }),

  r('SortSeq', 'SortItem', 1),
  r('SortSeq', 'SortSeq SortItem', 1, (k) => mergeSort(k[0] as SortT, k[1] as SortT)),
  r('SortItem', 'SORTV FIELD', 1, (k) => ({ cue: true, field: fieldT(k[1]) } satisfies SortT)),
  r('SortItem', 'SORTV BY FIELD', 1, (k) => ({ cue: true, field: fieldT(k[2]) } satisfies SortT)),
  r('SortItem', 'SORTV', 1, () => ({ cue: true } satisfies SortT)),
  r('SortItem', 'BY FIELD', 1, (k) => ({ field: fieldT(k[1]) } satisfies SortT)),
  r('SortItem', 'DIR', 1, (k) => ({ dir: k[0] as 'asc' | 'desc' } satisfies SortT)),
  r('SortItem', 'SORTPH', 1, (k) => ({ cue: true, dir: k[0] as 'asc' | 'desc' } satisfies SortT)),
  r('SortItem', 'LIMITN', 1, (k) => ({ cue: true, ...(k[0] as { limit: number; dir: 'asc' | 'desc' }) } satisfies SortT)),
  r(
    'SortItem',
    'SUPN',
    1,
    (k) => ({ cue: true, ...(k[0] as { limit: number; dir: 'asc' | 'desc'; hint: string }) } satisfies SortT),
  ),
  r('SortItem', 'SUPER', 1, (k) => ({ cue: true, ...(k[0] as SuperT) } satisfies SortT)),
  // "most expensive", "cheapest 5", "price lowest", "latest closing first"
  r('SortItem', 'SUPW', 1, (k) => ({ cue: true, ...(k[0] as SuperT) } satisfies SortT)),
  r('SortItem', 'SUPW FIELD', 1, (k) => ({ cue: true, dir: (k[0] as SuperT).dir, field: fieldT(k[1]) } satisfies SortT)),
  r('SortItem', 'SUPER FIELD', 1, (k) => ({ cue: true, dir: (k[0] as SuperT).dir, field: fieldT(k[1]) } satisfies SortT)),
  r('SortItem', 'FIELD SUPW', 1, (k) => ({ cue: true, dir: (k[1] as SuperT).dir, field: fieldT(k[0]) } satisfies SortT)),
  r(
    'SortItem',
    'SUPW NUM',
    1,
    (k) => ({ cue: true, ...(k[0] as SuperT), limit: (k[1] as ValT & { t: 'num' }).value } satisfies SortT),
  ),
  // "sort a to z", "title z-a": alphabetical, on the display field unless one is named.
  r('SortItem', 'ALPHA', 1, (k) => ({ cue: true, dir: k[0] as 'asc' | 'desc', hint: 'alpha' } satisfies SortT)),
  // A field with no cue of its own, next to one: "price low to high", "close date newest first".
  r('SortItem', 'FIELD', 0.95, (k) => ({ field: fieldT(k[0]) } satisfies SortT)),
  r('SortItem', 'FIRSTW', 1, () => ({} satisfies SortT)),

  /* ------------------------------------------------------------------------------------- group */
  r('Group', 'GROUPV FIELD', 1, (k) => groupBody(fieldT(k[1]))),
  // "by source", "deals by stage": a leading or bare "by" groups.
  r('Group', 'BY FIELD', 0.9, (k) => groupBody(fieldT(k[1]))),
  r('Group', 'GROUPV BY FIELD', 1, (k) => groupBody(fieldT(k[2]))),
  r('Group', 'Expr GROUPV FIELD', 1, (k) => groupBody(fieldT(k[2]), cond(k[0]))),
  r('Group', 'Expr GROUPV BY FIELD', 1, (k) => groupBody(fieldT(k[3]), cond(k[0]))),
  r('Group', 'GROUPV FIELD Expr', 1, (k) => groupBody(fieldT(k[1]), cond(k[2]))),
  r('Group', 'GROUPV BY FIELD Expr', 1, (k) => groupBody(fieldT(k[2]), cond(k[3]))),

  /* ---------------------------------------------------------------- edits, fills and creates */
  r('Q', 'Fill', 1),
  r('Q', 'Create', 1),
  ...EDIT_RULES,
  ...EXTRA_RULES,
]

function cueCond(ctx: CmdNlCtx, cue: string, v: ValT): Cond | undefined {
  if (v.t !== 'member' && v.t !== 'me') return
  const user = v.t === 'member' ? cmdNlField(ctx.schema, v.fieldId) : pickField(fieldsOf(ctx, ['user']), [cue])
  const value = user ? fit(user, v) : undefined
  return user && value !== undefined ? leafOf(user, 'anyof', value, 'implicit') : undefined
}

export const CMD_NL_GRAMMAR = compileChartGrammar(RULES)
export const CMD_NL_RULE_COUNT = RULES.length
