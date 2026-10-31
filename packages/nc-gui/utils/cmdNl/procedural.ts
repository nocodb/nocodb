import dayjs from 'dayjs'
import { parseCmdRelativeEdits } from '../commandPaletteRelativeEdit'
import { parseCmdSetAction, splitCmdWhere } from '../commandPaletteDataOps'
import { fromRelativeEdit, fromSetAction, legacyCmdNlParse, withMeta } from './adapters'
import type { CmdNlToken } from './extract'
import { cmdNlWordList, dateAt, numberAt, phraseAt, tokenizeCmdNl, weekdayAt, windowAt } from './extract'
import type { Agg, CmdIR, CmdNlCmp, Cond, CondLeaf, FieldRef, Scalar, Span } from './ir'
import { andConds, condLeaves, isCondLeaf } from './ir'
import type { CmdNlLexMatch, CmdNlLexicon } from './lexicon'
import { buildCmdNlLexicon, cmdNlLexAt, cmdNlLiteralGuard, cmdNlWordMatch } from './lexicon'
import type { CmdNlField, CmdNlSchema } from './schema'
import { cmdNlField, toCmdStatColumns } from './schema'
import { validateIR } from './validate'
import { AGG_WORDS, AGG_WORDS_EXTRA, DATE_AGG, DATE_ONLY_AGG, SORT_SUPERLATIVES } from './vocab/aggregations'
import type { StatAgg } from './vocab/aggregations'
import { CMP_PHRASES, NEGATIONS, TRAILING_CMP } from './vocab/comparators'
import { DATE_NOUNS } from './vocab/dates'
import { CONJUNCTIONS, GLUE_WORDS, LEAD_FILLERS } from './vocab/fillers'
import { possessive } from './vocab/inflect'
import { GROUP_VERBS, LIMIT_WORDS, PER_WORDS, SORT_DIRECTIONS, SORT_PHRASES, SORT_VERBS } from './vocab/verbs'
import {
  CHECKBOX_ANTONYMS,
  DATE_FIELD_HINTS,
  FINAL_OPTIONS,
  MEMBER_CUES,
  ME_WORDS,
  NUMBER_FIELD_HINTS,
  OPEN_WORDS,
  OVERDUE_WORDS,
  QUANTITY_NOUNS,
} from './vocab/hints'

/** First-success recursive descent per intent; a fallback contender next to the chart grammar. */

export interface CmdNlParseOptions {
  now?: dayjs.Dayjs
  /** Loaded rows, for value anchors ("austin deals"). */
  rows?: Record<string, unknown>[]
  /** Skip the legacy parsers (for comparing readers on their own). */
  legacy?: boolean
}

/** A reading must explain every non-glue word; partial readings are left to the AI fallback. */
const MIN_COVERAGE = 1

/** State words that first mean "not archived/disabled" rather than "not done". */
const ANTONYM_FIRST = new Set(['active', 'current', 'enabled', 'visible', 'live'])

/** Legacy readings: fairly sure alone, but a full-coverage grammar reading of the same intent outranks them. */
const LEGACY_SCORE = 0.9
const LEGACY_SCORE_CONTESTED = 0.75

export interface CmdNlCtx {
  tokens: CmdNlToken[]
  lex: CmdNlLexicon
  schema: CmdNlSchema
  now: dayjs.Dayjs
  /** Loaded rows, for data-relative assumptions ("big deals" → the top quarter of amounts). */
  rows?: Record<string, unknown>[]
}

type Ctx = CmdNlCtx

const ref = (id: string, via: FieldRef['via']): FieldRef => ({ id, via })

/* ------------------------------------------------------------------------------ field choice */

/** Fields of these kinds; the hidden audit fields only when the table has no user field of them. */
export const fieldsOf = (ctx: Ctx, kinds: CmdNlField['kind'][]) => {
  const all = ctx.schema.fields.filter((f) => kinds.includes(f.kind))
  const user = all.filter((f) => !f.system)
  return user.length ? user : all
}

/** The hidden audit field of this UIDT ("CreatedTime"), when the schema carries it. */
export const systemField = (ctx: Ctx, uidt: string) => ctx.schema.fields.find((f) => f.system && f.uidt === uidt)

/** The field a hint word points at among `candidates` ("assigned" → Assignee), else the first. */
export function pickField(candidates: CmdNlField[], hints: string[]): CmdNlField | undefined {
  for (const hint of hints) {
    const hit = candidates.find((f) =>
      f.title
        .toLowerCase()
        .split(/\s+/)
        .some((w) => cmdNlWordMatch(hint, w)),
    )
    if (hit) return hit
  }
  return candidates[0]
}

export const numberField = (ctx: Ctx) => pickField(fieldsOf(ctx, ['number']), NUMBER_FIELD_HINTS)
export const dateField = (ctx: Ctx) => pickField(fieldsOf(ctx, ['date', 'datetime']), DATE_FIELD_HINTS)

/* ---------------------------------------------------------------------------------- the reader */

/** Reads one stretch of tokens (possibly with gaps: `idx` are global token indices). */
class Reader {
  pos = 0
  used = new Set<number>()
  quality: number[] = []
  spans: Span[] = []
  readonly toks: CmdNlToken[]
  readonly words: string[]

  constructor(readonly ctx: Ctx, readonly idx: number[]) {
    this.toks = idx.map((k) => ctx.tokens[k]!)
    this.words = cmdNlWordList(this.toks)
  }

  get done() {
    return this.pos >= this.toks.length
  }

  word(k = this.pos) {
    return this.words[k]
  }

  snapshot() {
    return { pos: this.pos, used: new Set(this.used), quality: [...this.quality], spans: [...this.spans] }
  }

  restore(s: ReturnType<Reader['snapshot']>) {
    this.pos = s.pos
    this.used = s.used
    this.quality = s.quality
    this.spans = s.spans
  }

  take(end: number, tag?: Span['tag'], refId?: string, score = 1) {
    for (let k = this.pos; k < end; k++) this.used.add(this.idx[k]!)
    if (tag && end > this.pos) {
      this.spans.push({ start: this.toks[this.pos]!.start, end: this.toks[end - 1]!.end, tag, ref: refId, score })
    }
    this.pos = end
  }

  isGlue(word: string | undefined) {
    return !!word && (GLUE_WORDS.has(word) || this.ctx.lex.tableNouns.has(word))
  }

  skipGlue(extra: string[] = []) {
    while (!this.done) {
      const w = this.word()!
      // "me" is glue in "show me …" but a value after a comparator; callers read values before skipping.
      if (!this.isGlue(w) && !extra.includes(w)) break
      this.take(this.pos + 1)
    }
  }

  lexAt(kinds: Array<'field' | 'value' | 'member'>): CmdNlLexMatch[] {
    return cmdNlLexAt(this.ctx.lex, this.words, this.pos, kinds)
  }

  fieldAt(): { field: CmdNlField; end: number; score: number; via: FieldRef['via'] } | undefined {
    const m = this.lexAt(['field'])[0]
    if (!m) return
    const field = cmdNlField(this.ctx.schema, m.entry.fieldId)
    if (!field) return
    const via: FieldRef['via'] = m.via === 'fuzzy' ? 'fuzzy' : m.entry.quality < 1 || m.via !== 'exact' ? 'synonym' : 'title'
    let end = m.end
    // "close date", "due date": a date noun after a date field belongs to it.
    if ((field.kind === 'date' || field.kind === 'datetime') && DATE_NOUNS.has(this.words[end] ?? '')) end++
    return { field, end, score: m.score, via }
  }

  /* ---------------------------------------------------------------------------------- values */

  /** One value for `field` at the cursor, fitted to its kind. */
  valueFor(field: CmdNlField): { value: Scalar | Scalar[]; end: number; score: number } | undefined {
    const t = this.toks[this.pos]
    const w = this.word()
    if (!t || !w) return
    switch (field.kind) {
      case 'number': {
        const n = numberAt(this.toks, this.pos)
        return n ? { value: n.value, end: n.end, score: 1 } : undefined
      }
      case 'date':
      case 'datetime': {
        const d = weekdayAt(this.toks, this.pos, this.ctx.now) ?? dateAt(this.toks, this.pos, this.ctx.now)
        return d ? { value: d.value, end: d.end, score: 1 } : undefined
      }
      case 'checkbox':
        if (/^(true|yes|checked|ticked|done|on|1)$/.test(w)) return { value: true, end: this.pos + 1, score: 1 }
        if (/^(false|no|unchecked|unticked|off|0)$/.test(w)) return { value: false, end: this.pos + 1, score: 1 }
        return
      case 'user': {
        if (ME_WORDS.has(w)) return { value: { me: true }, end: this.pos + 1, score: 1 }
        const m = this.lexAt(['member']).find((x) => x.entry.fieldId === field.id)
        return m ? { value: { member: m.entry.value! }, end: m.end, score: m.score } : undefined
      }
      case 'select':
      case 'multiselect': {
        const m = this.lexAt(['value']).find((x) => x.entry.fieldId === field.id)
        if (!m) return
        return { value: field.kind === 'multiselect' ? [m.entry.value!] : m.entry.value!, end: m.end, score: m.score }
      }
      default: {
        if (t.quoted) return { value: t.text, end: this.pos + 1, score: 1 }
        const m = this.lexAt(['value']).find((x) => x.entry.fieldId === field.id)
        if (m) return { value: m.entry.value!, end: m.end, score: m.score }
      }
    }
  }

  /** Free text after "contains"/"like": quoted, or the words up to a conjunction or the end. */
  textRun(): { value: string; end: number } | undefined {
    const t = this.toks[this.pos]
    if (!t) return
    if (t.quoted) return { value: t.text, end: this.pos + 1 }
    let end = this.pos
    while (end < this.toks.length && !CONJUNCTIONS[this.words[end]!] && !['(', ')', ','].includes(this.words[end]!)) end++
    if (end === this.pos) return
    return {
      value: this.toks
        .slice(this.pos, end)
        .map((x) => x.text)
        .join(' '),
      end,
    }
  }

  /* ------------------------------------------------------------------------------ conditions */

  /** or-of-ands, with parentheses; fails (undefined) when an atom can't be read. */
  expr(): Cond | undefined {
    const first = this.andExpr()
    if (!first) return
    const args = [first]
    while (!this.done && CONJUNCTIONS[this.word()!] === 'or') {
      const s = this.snapshot()
      this.take(this.pos + 1, 'conj', 'or')
      const next = this.andExpr(lastLeaf(args[args.length - 1]!))
      if (!next) {
        this.restore(s)
        break
      }
      args.push(next)
    }
    return args.length === 1 ? args[0] : { op: 'or', args }
  }

  andExpr(prev?: CondLeaf): Cond | undefined {
    const first = this.atom() ?? (prev ? this.continuation(prev) : undefined)
    if (!first) return
    const args = [first]
    for (;;) {
      if (this.done) break
      const w = this.word()!
      if (w === ')') break
      // "austin deals that are won or lost": an "or" between two values of one field binds to that field.
      if (CONJUNCTIONS[w] === 'or') {
        const s = this.snapshot()
        const last = args[args.length - 1]!
        const leaf = lastLeaf(last)
        this.take(this.pos + 1, 'conj', 'or')
        const next = this.atom() ?? this.continuation(leaf)
        if (leaf && next && isCondLeaf(next) && next.field.id === leaf.field.id && args.length > 1) {
          args[args.length - 1] =
            !isCondLeaf(last) && last.op === 'or' ? { op: 'or', args: [...last.args, next] } : { op: 'or', args: [last, next] }
          continue
        }
        this.restore(s)
        break
      }
      const s = this.snapshot()
      if (CONJUNCTIONS[w] === 'and' || w === ',' || w === 'but') this.take(this.pos + 1, 'conj', 'and')
      const next = this.atom() ?? this.continuation(lastLeaf(args[args.length - 1]!))
      if (!next) {
        this.restore(s)
        break
      }
      args.push(next)
    }
    return mergeSameField(args)
  }

  /** "stage is won or lost", "city is austin or boston": a bare value continuing the previous leaf. */
  continuation(prev: CondLeaf | undefined): Cond | undefined {
    if (!prev) return
    const field = cmdNlField(this.ctx.schema, prev.field.id)
    if (!field || ['blank', 'notblank', 'checked', 'notchecked', 'between', 'within'].includes(prev.cmp)) return
    const s = this.snapshot()
    this.skipGlue()
    const v =
      this.valueFor(field) ??
      (field.kind === 'text' && /^[\p{L}\p{N}]/u.test(this.word() ?? '')
        ? { value: this.toks[this.pos]!.text, end: this.pos + 1, score: 0.8 }
        : undefined)
    if (!v) {
      this.restore(s)
      return
    }
    this.quality.push(v.score)
    this.take(v.end, 'value', field.id, v.score)
    return leafOf(field, prev.cmp, v.value, prev.field.via)
  }

  atom(): Cond | undefined {
    const s = this.snapshot()
    const cond = this.atomInner()
    if (!cond) this.restore(s)
    return cond
  }

  private atomInner(): Cond | undefined {
    this.skipGlue(['by'])
    if (this.done) return
    const w = this.word()!

    if (w === '(') {
      this.take(this.pos + 1)
      const inner = this.expr()
      if (!inner || this.word() !== ')') return
      this.take(this.pos + 1)
      return inner
    }

    // "not lost", "without owner", "exclude archived"
    if (NEGATIONS.has(w)) {
      this.take(this.pos + 1, 'neg')
      this.skipGlue()
      const f = this.fieldAt()
      if (f && (w === 'without' || w === 'no' || w === 'missing' || w === 'lacking')) {
        const after = this.snapshot()
        this.take(f.end, 'field', f.field.id, f.score)
        // "without owner" → owner is empty; but "no owner ann" isn't this shape.
        if (this.done || this.atEnd()) {
          this.quality.push(f.score)
          return leafOf(f.field, f.field.kind === 'checkbox' ? 'notchecked' : 'blank', undefined, f.via)
        }
        this.restore(after)
      }
      const inner = this.atom()
      return inner ? negate(inner) : undefined
    }

    // "unsigned", "unassigned": a checkbox or user field by its stem, never by a typo match.
    if (w.length > 4 && w.startsWith('un')) {
      const rest = w.slice(2)
      const stemHit = (f: CmdNlField) =>
        f.title
          .toLowerCase()
          .split(/\s+/)
          .some((t) => (cmdNlWordMatch(rest, t)?.score ?? 0) >= 0.85)
      const target =
        (/^assign|^own/.test(rest) ? pickField(fieldsOf(this.ctx, ['user']), [rest]) : undefined) ??
        this.ctx.schema.fields.find((f) => (f.kind === 'checkbox' || f.kind === 'user') && stemHit(f))
      if (target) {
        this.take(this.pos + 1, 'field', target.id, 0.9)
        this.quality.push(0.9)
        return leafOf(target, target.kind === 'checkbox' ? 'notchecked' : 'blank', undefined, 'synonym')
      }
    }

    // "my deals", "mine"
    if (w === 'my' || w === 'mine') {
      const user = pickField(fieldsOf(this.ctx, ['user']), ['owner', 'assignee'])
      if (!user) return
      this.take(this.pos + 1, 'value', user.id)
      this.quality.push(0.9)
      return leafOf(user, 'anyof', { me: true }, 'implicit')
    }

    // "ann's deals", "leo's bugs"
    const owner = possessive(w)
    if (owner) {
      const users = fieldsOf(this.ctx, ['user'])
      for (const user of users) {
        const m = cmdNlLexAt(this.ctx.lex, [owner], 0, ['member']).find((x) => x.entry.fieldId === user.id)
        if (m) {
          this.take(this.pos + 1, 'value', user.id, m.score)
          this.quality.push(m.score * 0.9)
          return leafOf(user, 'anyof', { member: m.entry.value! }, 'implicit')
        }
      }
    }

    // "owned by ann", "assigned to me"; a field called "Owner" is read as the field below instead.
    if (MEMBER_CUES.has(w) && this.fieldAt()?.via !== 'title') {
      const s = this.snapshot()
      this.take(this.pos + 1)
      this.skipGlue(['by'])
      const user = pickField(fieldsOf(this.ctx, ['user']), [w])
      const v = user ? this.valueFor(user) : undefined
      if (user && v) {
        this.take(v.end, 'value', user.id, v.score)
        this.quality.push(v.score * 0.95)
        return leafOf(user, 'anyof', v.value, 'implicit')
      }
      this.restore(s)
    }

    // "overdue", "past due"
    const overdue = phraseAt(this.words, this.pos, OVERDUE_WORDS)
    if (overdue) {
      const due = dateField(this.ctx)
      if (!due) return
      this.take(overdue.end, 'date', due.id)
      this.quality.push(0.85)
      return leafOf(due, 'lt', { relative: 'today' }, 'implicit')
    }

    // A window with no field: "closing in the next 7 days" reads through the field below; this is "next week".
    const win = windowAt(this.toks, this.pos)
    if (win) {
      const date = dateField(this.ctx)
      if (!date) return
      this.take(win.end, 'date', win.value.relative)
      this.quality.push(0.8)
      return leafOf(date, 'within', win.value, 'implicit')
    }

    const field = this.fieldAt()
    if (field) {
      const s = this.snapshot()
      this.take(field.end, 'field', field.field.id, field.score)
      const cond = this.afterField(field.field, field.via)
      if (cond) {
        this.quality.push(field.score)
        return cond
      }
      this.restore(s)
    }

    // "open tasks", "active tasks", "pending": a state without a field.
    if (OPEN_WORDS.has(w) || CHECKBOX_ANTONYMS[w]) {
      const state = this.stateAt(w)
      if (state) return state
    }

    // A comparator with no field: "over 10k" (a number field), "before oct 1" (a date field).
    const cmp = phraseAt(this.words, this.pos, CMP_PHRASES, true)
    if (cmp && !['eq', 'anyof', 'like'].includes(cmp.value)) {
      const s = this.snapshot()
      this.take(cmp.end, 'cmp', cmp.value, cmp.score)
      const looksDate = !!dateAt(this.toks, this.pos, this.ctx.now) || !!windowAt(this.toks, this.pos)
      const implicit = looksDate ? dateField(this.ctx) : numberField(this.ctx)
      if (implicit) {
        const cond = this.compare(implicit, cmp.value, 'implicit')
        if (cond) {
          this.quality.push(cmp.score * 0.8)
          return cond
        }
      }
      this.restore(s)
    }

    // Value-linked: "won deals", "urgent", "austin", "for anbarasu".
    const value = this.lexAt(['value', 'member'])[0]
    if (value) {
      const f = cmdNlField(this.ctx.schema, value.entry.fieldId)
      if (!f) return
      this.take(value.end, 'value', f.id, value.score)
      this.quality.push(value.score * 0.9)
      if (value.entry.kind === 'member') return leafOf(f, 'anyof', { member: value.entry.value! }, 'value')
      return leafOf(f, 'eq', f.kind === 'multiselect' ? [value.entry.value!] : value.entry.value!, 'value')
    }
  }

  /** "active" with an Archived checkbox → not archived; "open" with a Done option → status isn't done. */
  stateAt(w: string): Cond | undefined {
    const byCheckbox = () => {
      const antonyms = CHECKBOX_ANTONYMS[w] ?? []
      const box = fieldsOf(this.ctx, ['checkbox']).find((f) =>
        f.title
          .toLowerCase()
          .split(/\s+/)
          .some((t) => antonyms.includes(t)),
      )
      if (!box) return
      this.take(this.pos + 1, 'value', box.id, 0.8)
      this.quality.push(0.8)
      return leafOf(box, 'notchecked', undefined, 'implicit')
    }
    const bySelect = () => {
      if (!OPEN_WORDS.has(w)) return
      for (const select of fieldsOf(this.ctx, ['select'])) {
        const finals = (select.options ?? []).filter((o) => FINAL_OPTIONS.has(o.toLowerCase()))
        if (!finals.length || finals.length === select.options?.length) continue
        this.take(this.pos + 1, 'value', select.id, 0.8)
        this.quality.push(0.8)
        return finals.length === 1 ? leafOf(select, 'neq', finals[0]!, 'implicit') : leafOf(select, 'nanyof', finals, 'implicit')
      }
    }
    // "active"/"current" are about visibility (an Archived box); "open"/"pending" about progress (a status).
    return ANTONYM_FIRST.has(w) ? byCheckbox() ?? bySelect() : bySelect() ?? byCheckbox()
  }

  /** At a conjunction, a closing paren or the end. */
  atEnd() {
    const w = this.word()
    return !w || !!CONJUNCTIONS[w] || w === ')' || w === ','
  }

  /** What follows a field: a comparator and value, a bare value, a window, or nothing (checkbox). */
  afterField(field: CmdNlField, via: FieldRef['via']): Cond | undefined {
    const isDate = field.kind === 'date' || field.kind === 'datetime'

    // Comparators first ("is not", "is empty", "at least" start with glue words), then again past glue.
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) {
        const before = this.pos
        this.skipGlue(field.kind === 'user' ? [] : ['by'])
        if (this.pos === before) break
      }
      if (isDate) {
        const win = windowAt(this.toks, this.pos)
        if (win) {
          this.take(win.end, 'date', win.value.relative)
          return leafOf(field, 'within', win.value, via)
        }
      }
      const cmp = phraseAt(this.words, this.pos, CMP_PHRASES, true)
      if (cmp) {
        const s = this.snapshot()
        this.take(cmp.end, 'cmp', cmp.value, cmp.score)
        const cond = this.compare(field, cmp.value, via)
        if (cond) {
          if (cmp.score < 1) this.quality.push(cmp.score)
          return cond
        }
        this.restore(s)
      }
      // "stage not lost", "archived not checked"
      if (NEGATIONS.has(this.word() ?? '')) {
        const s = this.snapshot()
        this.take(this.pos + 1, 'neg')
        const inner = this.afterField(field, via)
        if (inner) return negate(inner)
        this.restore(s)
      }
    }

    if (field.kind === 'checkbox' && this.atEnd()) return leafOf(field, 'checked', undefined, via)

    const v = this.valueFor(field)
    if (v) {
      this.take(v.end, 'value', field.id, v.score)
      if (v.score < 1) this.quality.push(v.score)
      const trailing = phraseAt(this.words, this.pos, TRAILING_CMP)
      if (trailing && field.kind === 'number') {
        this.take(trailing.end, 'cmp', trailing.value)
        return leafOf(field, trailing.value, v.value, via)
      }
      return leafOf(field, 'eq', v.value, via)
    }

    // A checkbox on its own is "checked": "signed won deals", "signed deals".
    if (field.kind === 'checkbox') return leafOf(field, 'checked', undefined, via)
  }

  /** A comparator's value(s), shaped by the comparator. */
  compare(field: CmdNlField, cmp: CmdNlCmp, via: FieldRef['via']): Cond | undefined {
    if (cmp === 'blank' || cmp === 'notblank') return leafOf(field, cmp, undefined, via)
    if (cmp === 'checked' || cmp === 'notchecked')
      return field.kind === 'checkbox' ? leafOf(field, cmp, undefined, via) : undefined

    const isDate = field.kind === 'date' || field.kind === 'datetime'
    if (cmp === 'within') {
      if (!isDate) return
      const win = windowAt(this.toks, this.pos)
      if (!win) return
      this.take(win.end, 'date', win.value.relative)
      return leafOf(field, 'within', win.value, via)
    }
    if (cmp === 'between') {
      if (field.kind !== 'number' && !isDate) return
      const a = this.valueFor(field)
      if (!a) return
      this.take(a.end, 'value', field.id)
      if (!['and', 'to', '-', 'through', 'thru', 'till', 'until'].includes(this.word() ?? '')) return
      this.take(this.pos + 1)
      const b = this.valueFor(field)
      if (!b) return
      this.take(b.end, 'value', field.id)
      return leafOf(field, 'between', [a.value as Scalar, b.value as Scalar], via)
    }

    if (field.kind === 'checkbox') {
      const v = this.valueFor(field)
      if (!v || (cmp !== 'eq' && cmp !== 'neq')) return
      this.take(v.end, 'value', field.id)
      return leafOf(field, (v.value === true) === (cmp === 'eq') ? 'checked' : 'notchecked', undefined, via)
    }

    // A window or relative day after a date comparator: "after next week" isn't a thing; "before today" is.
    if (cmp === 'anyof' || cmp === 'nanyof') {
      const list: Scalar[] = []
      for (;;) {
        const v = this.valueFor(field)
        if (!v) break
        this.take(v.end, 'value', field.id, v.score)
        list.push(...(Array.isArray(v.value) ? v.value : [v.value]))
        if (![',', 'or', 'and'].includes(this.word() ?? '')) break
        const s = this.snapshot()
        this.take(this.pos + 1)
        if (!this.valueFor(field)) {
          this.restore(s)
          break
        }
      }
      if (!list.length) return
      if (field.kind === 'user') return leafOf(field, cmp, list.length === 1 ? list[0]! : list, via)
      return leafOf(field, cmp, list, via)
    }

    if (cmp === 'like' || cmp === 'nlike') {
      if (field.kind === 'select' || field.kind === 'multiselect' || field.kind === 'user') {
        const v = this.valueFor(field)
        if (!v) return
        this.take(v.end, 'value', field.id, v.score)
        return leafOf(field, cmp === 'like' ? 'anyof' : 'nanyof', v.value, via)
      }
      if (field.kind !== 'text' && field.kind !== 'other') return
      const run = this.textRun()
      if (!run) return
      this.take(run.end, 'value', field.id)
      return leafOf(field, cmp, run.value, via)
    }

    const v = this.valueFor(field) ?? (field.kind === 'text' && cmp !== 'eq' ? undefined : undefined)
    if (!v) {
      if ((field.kind === 'text' || field.kind === 'other') && (cmp === 'eq' || cmp === 'neq')) {
        const run = this.textRun()
        if (!run) return
        this.take(run.end, 'value', field.id, 0.8)
        this.quality.push(0.8)
        return leafOf(field, cmp, run.value, via)
      }
      return
    }
    if (['gt', 'gte', 'lt', 'lte'].includes(cmp) && field.kind !== 'number' && !isDate) return
    this.take(v.end, 'value', field.id, v.score)
    if (v.score < 1) this.quality.push(v.score)
    return leafOf(field, cmp, v.value, via)
  }
}

/* ------------------------------------------------------------------------------- tree helpers */

export function leafOf(field: CmdNlField, cmp: CmdNlCmp, value: Scalar | Scalar[] | undefined, via: FieldRef['via']): CondLeaf {
  let c = cmp
  let v = value
  if (field.kind === 'user' && (c === 'eq' || c === 'neq')) c = c === 'eq' ? 'anyof' : 'nanyof'
  if (field.kind === 'multiselect' && (c === 'eq' || c === 'neq')) {
    c = c === 'eq' ? 'anyof' : 'nanyof'
    if (v !== undefined && !Array.isArray(v)) v = [v]
  }
  if (field.kind === 'select' && c === 'eq' && Array.isArray(v) && v.length > 1) c = 'anyof'
  if (field.kind === 'select' && (c === 'eq' || c === 'neq') && Array.isArray(v) && v.length === 1) v = v[0]
  return v === undefined ? { field: ref(field.id, via), cmp: c } : { field: ref(field.id, via), cmp: c, value: v }
}

const FLIP: Partial<Record<CmdNlCmp, CmdNlCmp>> = {
  eq: 'neq',
  neq: 'eq',
  anyof: 'nanyof',
  nanyof: 'anyof',
  like: 'nlike',
  nlike: 'like',
  checked: 'notchecked',
  notchecked: 'checked',
  blank: 'notblank',
  notblank: 'blank',
  gt: 'lte',
  lte: 'gt',
  lt: 'gte',
  gte: 'lt',
}

export function negate(cond: Cond): Cond {
  if (isCondLeaf(cond)) {
    const flipped = FLIP[cond.cmp]
    return flipped ? { ...cond, cmp: flipped } : { op: 'not', arg: cond }
  }
  if (cond.op === 'not') return cond.arg
  return { op: 'not', arg: cond }
}

function lastLeaf(cond: Cond): CondLeaf | undefined {
  if (isCondLeaf(cond)) return cond
  if (cond.op === 'not') return
  return lastLeaf(cond.args[cond.args.length - 1]!)
}

/** "lead and qualified deals": two values of one single-select field can't both hold, so it's a list. */
export function mergeSameField(args: Cond[]): Cond | undefined {
  const flat = andConds(args)
  if (!flat || isCondLeaf(flat) || flat.op !== 'and') return flat
  const eqs = flat.args.filter((a): a is CondLeaf => isCondLeaf(a) && a.cmp === 'eq' && typeof a.value === 'string')
  const byField = new Map<string, CondLeaf[]>()
  for (const leaf of eqs) byField.set(leaf.field.id, [...(byField.get(leaf.field.id) ?? []), leaf])
  const merged: Cond[] = []
  const done = new Set<string>()
  for (const a of flat.args) {
    if (isCondLeaf(a) && a.cmp === 'eq' && typeof a.value === 'string' && (byField.get(a.field.id)?.length ?? 0) > 1) {
      if (done.has(a.field.id)) continue
      done.add(a.field.id)
      merged.push({ field: a.field, cmp: 'anyof', value: byField.get(a.field.id)!.map((l) => l.value as Scalar) })
      continue
    }
    merged.push(a)
  }
  return andConds(merged)
}

/* ------------------------------------------------------------------------------------ readers */

interface Reading {
  body: Omit<CmdIR, 'meta'>
  used: Set<number>
  quality: number[]
  spans: Span[]
}

function allIdx(ctx: Ctx, except: Set<number> = new Set()) {
  return ctx.tokens.map((_, k) => k).filter((k) => !except.has(k))
}

/** Conditions over the tokens not yet used; the whole remainder must read (glue aside). */
function readWhere(ctx: Ctx, used: Set<number>): { where?: Cond; reader: Reader } | undefined {
  const reader = new Reader(ctx, allIdx(ctx, used))
  reader.skipGlue(['by'])
  if (reader.done) return { reader }
  const where = reader.expr()
  reader.skipGlue(['by'])
  if (!where || !reader.done) return
  return { where, reader }
}

function filterReading(ctx: Ctx): Reading | undefined {
  const r = readWhere(ctx, new Set())
  if (!r?.where) return
  return {
    body: { intent: 'filter', scope: 'where', where: r.where },
    used: r.reader.used,
    quality: r.reader.quality,
    spans: r.reader.spans,
  }
}

export function aggFor(agg: StatAgg, field: CmdNlField | undefined): string | undefined {
  if (!field) return agg === 'count' ? 'count' : undefined
  const isDate = field.kind === 'date' || field.kind === 'datetime'
  let fn: string = agg
  if (isDate && DATE_AGG[agg]) fn = DATE_AGG[agg]!
  if (agg === 'count') fn = 'count_filled'
  return field.aggregations.includes(fn) ? fn : undefined
}

/** "sum of amount where …", "total hardware qty", "count by assignee", "amount total". */
function statReadings(ctx: Ctx): Reading[] {
  const words = cmdNlWordList(ctx.tokens)
  let i = 0
  for (let opener = LEAD_FILLERS.find((p) => p.every((w, k) => words[i + k] === w)); opener; ) {
    i += opener.length
    opener = LEAD_FILLERS.find((p) => p.every((w, k) => words[i + k] === w))
  }
  const used = new Set<number>(Array.from({ length: i }, (_, k) => k))
  const out: Reading[] = []

  let agg: StatAgg | undefined
  const head = phraseAt(words, i, [...AGG_WORDS_EXTRA, ...AGG_WORDS])
  if (head) {
    agg = head.value
    for (let k = i; k < head.end; k++) used.add(k)
  } else if (DATE_ONLY_AGG[words[i] ?? '']) {
    agg = DATE_ONLY_AGG[words[i]!]
    used.add(i)
  } else {
    // "amount total", "score average": the aggregation last.
    const tail = words.length - 1
    const t = phraseAt(words, tail, [...AGG_WORDS_EXTRA, ...AGG_WORDS])
    if (t && tail > i && t.value !== 'count') {
      agg = t.value
      used.add(tail)
    }
  }

  // "tasks per assignee", "how many tasks each assignee has": a count by a field.
  const per = words.findIndex((w, k) => k >= i && PER_WORDS.has(w))
  let groupBy: FieldRef[] | undefined
  if (per >= 0) {
    const g = new Reader(ctx, allIdx(ctx).slice(per + 1))
    g.skipGlue()
    const f = g.fieldAt()
    if (f) {
      used.add(per)
      for (let k = g.pos; k < f.end; k++) used.add(g.idx[k]!)
      for (const k of g.used) used.add(k)
      groupBy = [ref(f.field.id, f.via)]
    }
  }
  // "tasks per assignee" counts; "estimate per status" adds the number field up.
  if (!agg && groupBy) {
    const before = new Reader(ctx, allIdx(ctx).slice(i, per))
    const numberFirst = before.fieldAt()?.field.kind === 'number'
    if (numberFirst) agg = 'sum'
    else if (words.slice(i, per).some((w) => ctx.lex.tableNouns.has(w))) agg = 'count'
  }
  if (!agg || agg === 'mode') return out

  // The aggregated field: the first field the aggregation fits, anywhere after the opener.
  const needsField = agg !== 'count'
  const scan = new Reader(ctx, allIdx(ctx, used))
  const candidates: Array<{ field: CmdNlField; via: FieldRef['via']; score: number; at: number[] }> = []
  for (let k = 0; k < scan.toks.length; k++) {
    scan.pos = k
    const f = scan.fieldAt()
    if (f && aggFor(agg, f.field)) candidates.push({ field: f.field, via: f.via, score: f.score, at: scan.idx.slice(k, f.end) })
  }

  const build = (target?: (typeof candidates)[number]) => {
    const u = new Set(used)
    for (const k of target?.at ?? []) u.add(k)
    // "how many hardware units": counting a quantity means adding it up.
    const quantity = agg === 'count' && target?.field.kind === 'number' && target.at.every((k) => QUANTITY_NOUNS.has(words[k]!))
    const fn = aggFor(quantity ? 'sum' : agg!, target?.field)
    if (!fn) return
    const r = readWhere(ctx, u)
    if (!r) return
    for (const k of r.reader.used) u.add(k)
    const aggs: Agg[] = [{ fn, field: target ? ref(target.field.id, target.via) : undefined }]
    out.push({
      body: { intent: 'stat', scope: r.where ? 'where' : 'view', where: r.where, aggs, groupBy },
      used: u,
      quality: [...r.reader.quality, target?.score ?? 1],
      spans: r.reader.spans,
    })
  }
  if (needsField) for (const c of candidates.slice(0, 3)) build(c)
  else {
    build()
    // "count unique referral source" arrives here as count_unique (needsField); plain "count" may name a field to fill.
    for (const c of candidates.slice(0, 1)) build(c)
  }
  return out
}

/** "sort by amount desc", "top 5 deals by amount", "biggest deals first", "… lowest first". */
function sortReadings(ctx: Ctx): Reading[] {
  const words = cmdNlWordList(ctx.tokens)
  const used = new Set<number>()
  let dir: 'asc' | 'desc' | undefined
  let limit: number | undefined
  let field: { field: CmdNlField; via: FieldRef['via']; score: number } | undefined
  let cue = false

  const takeFieldAt = (k: number) => {
    const r = new Reader(ctx, allIdx(ctx).slice(k))
    r.skipGlue(['by'])
    const f = r.fieldAt()
    if (!f) return false
    for (let j = 0; j < f.end; j++) used.add(r.idx[j]!)
    field = { field: f.field, via: f.via, score: f.score }
    return true
  }

  for (let k = 0; k < words.length; k++) {
    if (used.has(k)) continue
    const w = words[k]!
    const phrase = phraseAt(words, k, SORT_PHRASES)
    if (phrase) {
      dir = phrase.value
      for (let j = k; j < phrase.end; j++) used.add(j)
      cue = true
      continue
    }
    if (SORT_VERBS.has(w)) {
      used.add(k)
      cue = true
      takeFieldAt(k + 1)
      continue
    }
    if (SORT_DIRECTIONS[w]) {
      dir = SORT_DIRECTIONS[w]
      used.add(k)
      if (words[k + 1] === 'order') used.add(k + 1)
      continue
    }
    // "top 5", "first ten", "5 biggest"
    const n = numberAt(ctx.tokens, k)
    if (LIMIT_WORDS.has(w) && numberAt(ctx.tokens, k + 1)) {
      const nn = numberAt(ctx.tokens, k + 1)!
      limit = nn.value
      dir = w === 'bottom' ? 'asc' : 'desc'
      used.add(k)
      for (let j = k + 1; j < nn.end; j++) used.add(j)
      cue = true
      continue
    }
    // "5 biggest deals" opens the query; "qty under 10 lowest first" is a condition, then a direction.
    if (
      n &&
      SORT_SUPERLATIVES[words[n.end] ?? ''] &&
      (k === 0 || LIMIT_WORDS.has(words[k - 1]!)) &&
      words[n.end + 1] !== 'first'
    ) {
      limit = n.value
      dir = SORT_SUPERLATIVES[words[n.end]!]
      for (let j = k; j <= n.end; j++) used.add(j)
      cue = true
      k = n.end
      continue
    }
    if (
      SORT_SUPERLATIVES[w] &&
      (words[k + 2] === 'first' || words[k + 1] === 'first' || (k === 0 && ctx.lex.tableNouns.has(words[k + 1] ?? '')))
    ) {
      dir = SORT_SUPERLATIVES[w]
      used.add(k)
      if (words[k + 1] === 'first') used.add(k + 1)
      else if (words[k + 2] === 'first') used.add(k + 2)
      cue = true
      continue
    }
    if (w === 'by' && cue && !field) {
      used.add(k)
      takeFieldAt(k + 1)
    }
  }
  if (!cue) return []
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) return []

  const r = readWhere(ctx, used)
  if (!r) return []
  // No field named: the number field the condition uses, else the table's main number field.
  if (!field) {
    const condField = condLeaves(r.where)
      .map((l) => cmdNlField(ctx.schema, l.field.id))
      .find((f) => f?.kind === 'number')
    const implicit = condField ?? numberField(ctx)
    if (!implicit) return []
    field = { field: implicit, via: 'implicit', score: 0.85 }
  }
  for (const k of r.reader.used) used.add(k)
  return [
    {
      body: {
        intent: 'sort',
        scope: r.where ? 'where' : 'view',
        where: r.where,
        orderBy: [{ field: ref(field.field.id, field.via), dir: dir ?? 'asc' }],
        limit,
      },
      used,
      quality: [...r.reader.quality, field.score],
      spans: r.reader.spans,
    },
  ]
}

/** "group by status", "tasks grouped by status". */
function groupReadings(ctx: Ctx): Reading[] {
  const words = cmdNlWordList(ctx.tokens)
  const k = words.findIndex((w) => GROUP_VERBS.has(w))
  if (k < 0) return []
  const used = new Set<number>([k])
  const r = new Reader(ctx, allIdx(ctx).slice(k + 1))
  r.skipGlue(['by'])
  const f = r.fieldAt()
  if (!f) return []
  for (let j = 0; j < f.end; j++) used.add(r.idx[j]!)
  const w = readWhere(ctx, used)
  if (!w) return []
  for (const j of w.reader.used) used.add(j)
  return [
    {
      body: { intent: 'group', scope: w.where ? 'where' : 'view', where: w.where, groupBy: [ref(f.field.id, f.via)] },
      used,
      quality: [...w.reader.quality, f.score],
      spans: w.reader.spans,
    },
  ]
}

/** "set stage won where amount > 10000": the legacy action parsers with this parser's where-clause. */
function whereEditReadings(ctx: Ctx, query: string): CmdIR[] {
  const split = splitCmdWhere(query)
  if (!split) return []
  const clauseCtx: Ctx = { ...ctx, tokens: tokenizeCmdNl(split.clause, cmdNlLiteralGuard(ctx.lex)) }
  const r = readWhere(clauseCtx, new Set())
  if (!r?.where) return []
  const out: CmdIR[] = []
  const set = parseCmdSetAction(split.action, toCmdStatColumns(ctx.schema))
  if (set) {
    const ir = fromSetAction(set, ctx.schema, r.where)
    if (ir) out.push(ir)
  } else {
    for (const edit of parseCmdRelativeEdits(split.action)) {
      const ir = fromRelativeEdit(edit, ctx.schema, r.where)
      if (ir) out.push(ir)
    }
  }
  const q = gmean(r.reader.quality)
  return out.map((ir) => ({ ...ir, meta: { ...ir.meta, score: Math.min(0.95, q) } }))
}

/* -------------------------------------------------------------------------------------- entry */

export function gmean(values: number[]) {
  const vs = values.filter((v) => v > 0)
  if (!vs.length) return 1
  return Math.exp(vs.reduce((a, v) => a + Math.log(v), 0) / vs.length)
}

function coverage(ctx: Ctx, used: Set<number>) {
  const words = cmdNlWordList(ctx.tokens)
  let counted = 0
  let covered = 0
  words.forEach((w, k) => {
    counted++
    if (used.has(k) || GLUE_WORDS.has(w) || ctx.lex.tableNouns.has(w)) covered++
  })
  return counted ? covered / counted : 0
}

/** A reading's identity, ignoring how fields were found, the edit's typed field name and its meta. */
export function readingKey(ir: CmdIR) {
  return JSON.stringify(ir, (k, v) => (k === 'via' || k === 'meta' || (k === 'field' && typeof v === 'string') ? undefined : v))
}

/** The stage-2 readers' readings of `query` (plus legacy unless `opts.legacy === false`), best first. */
export function parseCmdNlProcedural(query: string, schema: CmdNlSchema, opts: CmdNlParseOptions = {}): CmdIR[] {
  const text = query.trim()
  if (!text) return []
  const now = opts.now ?? dayjs()
  const lex = buildCmdNlLexicon(schema, opts.rows)
  const ctx: Ctx = { tokens: tokenizeCmdNl(text, cmdNlLiteralGuard(lex)), lex, schema, now }
  if (!ctx.tokens.length) return []

  const readings: CmdIR[] = []
  const push = (r: Reading) => {
    const cov = coverage(ctx, r.used)
    if (cov < MIN_COVERAGE) return
    const ir = withMeta(r.body, schema, { score: cov * gmean(r.quality), coverage: cov, spans: r.spans, source: 'grammar' })
    if (validateIR(ir, schema).ok) readings.push(ir)
  }

  const filter = filterReading(ctx)
  if (filter) push(filter)
  for (const r of statReadings(ctx)) push(r)
  for (const r of sortReadings(ctx)) push(r)
  for (const r of groupReadings(ctx)) push(r)
  for (const ir of whereEditReadings(ctx, text)) if (validateIR(ir, schema).ok) readings.push(ir)

  if (opts.legacy !== false) {
    // The legacy parsers stay as candidates (edits, fills, creates, calc); they're narrow, so fairly sure.
    const grammarIntents = new Set(readings.map((r) => r.intent))
    for (const ir of legacyCmdNlParse(text, schema, { now })) {
      const score = grammarIntents.has(ir.intent) ? LEGACY_SCORE_CONTESTED : LEGACY_SCORE
      readings.push({ ...ir, meta: { ...ir.meta, score } })
    }
  }

  const best = new Map<string, CmdIR>()
  for (const ir of readings) {
    const key = readingKey(ir)
    const prev = best.get(key)
    if (!prev || ir.meta.score > prev.meta.score) best.set(key, ir)
  }
  return [...best.values()].sort((a, b) => b.meta.score - a.meta.score)
}
