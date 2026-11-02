import dayjs from 'dayjs'
import type * as ChronoEn from 'chrono-node/en'
import type { CmdNlRelativeDate, CmdNlTag, Scalar, Span } from './ir'
import type { CmdNlLexicon } from './lexicon'
import { cmdNlLexAt, normCmdNlWord } from './lexicon'
import { AGG_WORDS } from './vocab/aggregations'
import { CMP_PHRASES, NEGATIONS } from './vocab/comparators'
import { DATE_DAY_WORDS, MONTHS, MONTH_NAMES, WEEKDAY_NAMES } from './vocab/dates'
import { CONJUNCTIONS, GLUE_WORDS } from './vocab/fillers'
import { CURRENCY_SYMBOLS, WORD_NUMBERS, readCmdNumber } from './vocab/numbers'
import { CONTRACTIONS, PHRASE_REWRITES, QUARTERS, SHORTHAND, UN_EMPTY_STEMS } from './vocab/shorthand'
import { GROUP_VERBS, LIMIT_WORDS, PER_WORDS, SORT_DIRECTIONS, SORT_VERBS } from './vocab/verbs'

/* ------------------------------------------------------------------------------------ tokens */

export interface CmdNlToken {
  /** As typed (quotes stripped for quoted text). */
  text: string
  /** Normalised for lookups. */
  word: string
  start: number
  end: number
  quoted?: boolean
  /** A field value typed as is ("11-50", "500+"): shorthand, ranges and phrases leave it alone. */
  literal?: boolean
}

/** Whether raw token `i` is a value literal to keep verbatim (see cmdNlLiteralGuard). */
export type CmdNlLiteralGuard = (tokens: CmdNlToken[], i: number) => boolean

/**
 * Words, numbers ("1,000", "$2.5k", "10%"), ISO dates, quoted text, comparison operators and
 * punctuation that matters ("(", ")", ","). Possessives stay on the word ("ann's").
 */
export function tokenizeCmdNl(query: string, keepLiteral?: CmdNlLiteralGuard): CmdNlToken[] {
  const tokens: CmdNlToken[] = []
  const re =
    /"([^"]*)"|'([^']+)'(?=\s|$|[,.)])|[“‘]([^”’]*)[”’]|(>=|<=|!=|<>|==|[<>=()])|(,)(?!\d{3}(?:\D|$))|([^\s<>=()",“”‘’]+(?:,\d{3})*(?:[^\s<>=()",“”‘’]+)?)/g
  for (let m = re.exec(query); m; m = re.exec(query)) {
    const start = m.index
    const end = start + m[0].length
    const quoted = m[1] ?? m[2] ?? m[3]
    if (quoted !== undefined) {
      tokens.push({ text: quoted, word: quoted.toLowerCase(), start, end, quoted: true })
      continue
    }
    const raw = m[0].replace(/[?!.;:]+$/, '')
    if (!raw) continue
    tokens.push({
      text: raw,
      word: /^[<>=!()]+$|^,$/.test(raw) ? raw : normCmdNlWord(raw) || raw.toLowerCase(),
      start,
      end: start + raw.length,
    })
  }
  return normalizeCmdNlTokens(tokens, keepLiteral)
}

/* ------------------------------------------------------------------------------ normalisation */

/** Tokens standing in for `from` that read as `words` (same source range, so chips still point at it). */
const rewrite = (from: CmdNlToken, words: string[]): CmdNlToken[] =>
  words.map((word) => ({ text: word, word, start: from.start, end: from.end }))

const RANGE_TOKEN = new RegExp(
  String.raw`^([${CURRENCY_SYMBOLS}]?[\d.,]+(?:k|m|mn|bn|b)?)(?:-|–|—|\.\.)([${CURRENCY_SYMBOLS}]?[\d.,]+(?:k|m|mn|bn|b)?)$`,
)
const RANGE_SEPS = new Set(['to', 'through', 'thru', '-', '–', '—', 'till', 'until'])
const RANGE_OPENERS = new Set(['between', 'from', 'by'])
// After an edit verb "x to y" is a change, not a range: "change qty 3 to 5", "fill 1 to 10".
const EDIT_VERBS = new Set([
  'add',
  'plus',
  'minus',
  'subtract',
  'increase',
  'decrease',
  'raise',
  'lower',
  'reduce',
  'cut',
  'set',
  'change',
  'update',
  'make',
  'move',
  'shift',
  'push',
  'limit',
  'cap',
  'round',
  'multiply',
  'times',
  'divide',
  'fill',
])

/** "q3 2026" → "from jul 1 2026 to sep 30 2026"; the year is consumed when it follows. */
function quarterWords(quarter: [number, number, number], year?: string): string[] {
  const y = year ? [year] : []
  return ['from', MONTHS[quarter[0]]!, '1', ...y, 'to', MONTHS[quarter[1]]!, String(quarter[2]), ...y]
}

/**
 * Rewrites shorthand into the words every reader understands: contractions ("isnt" → "is not"),
 * chat spellings ("tmrw", "w/o"), period codes ("q3", "ytd"), numeric ranges ("5k-10k" → "between
 * 5k and 10k"), "un"+participle emptiness ("untagged" → "without tagged") and fixed phrases.
 */
export function normalizeCmdNlTokens(input: CmdNlToken[], keepLiteral?: CmdNlLiteralGuard): CmdNlToken[] {
  const editing = input.some((t) => EDIT_VERBS.has(t.word))
  const out: CmdNlToken[] = []
  for (let i = 0; i < input.length; i++) {
    const t = input[i]!
    if (t.quoted) {
      out.push(t)
      continue
    }
    if (keepLiteral?.(input, i)) {
      out.push({ ...t, literal: true })
      continue
    }
    const w = t.word
    // Raw text too: normalising drops the trailing "/" of "w/" and empties "&".
    const raw = t.text.toLowerCase()
    const expanded = CONTRACTIONS[w] ?? SHORTHAND[w] ?? SHORTHAND[raw]
    if (expanded) {
      out.push(...rewrite(t, expanded))
      continue
    }
    const quarter = QUARTERS[w]
    if (quarter) {
      const year = /^\d{4}$/.test(input[i + 1]?.word ?? '') ? input[++i]!.word : undefined
      // "in q3", "during q3": the quarter's own "from … to" replaces the preposition.
      if (['in', 'during', 'for', 'of'].includes(out[out.length - 1]?.word ?? '')) out.pop()
      out.push(...rewrite(t, quarterWords(quarter, year)))
      continue
    }
    if (w === 'ytd') {
      if (['in', 'during', 'for'].includes(out[out.length - 1]?.word ?? '')) out.pop()
      out.push(...rewrite(t, ['from', 'jan', '1', 'to', 'today']))
      continue
    }
    // "n/a" after a field means it's empty ("source n/a"); before one it reads as "no" ("n/a supplier").
    if (raw === 'n/a' || w === 'n/a') {
      const after = out.length > 0 && !GLUE_WORDS.has(out[out.length - 1]!.word)
      out.push(...rewrite(t, [after ? 'missing' : 'no']))
      continue
    }
    // "50%+", "4+", "10k+": a trailing plus is "or more".
    const plus = /^(.+)\+$/.exec(raw)
    if (plus && readCmdNumber(plus[1]!)) {
      out.push(...rewrite(t, [plus[1]!, 'or', 'more']))
      continue
    }
    const range = RANGE_TOKEN.exec(w)
    if (range && !editing && readCmdNumber(range[1]!) && readCmdNumber(range[2]!)) {
      out.push(...rewrite(t, ['between', range[1]!, 'and', range[2]!]))
      continue
    }
    const un = /^un(.+)$/.exec(w)
    if (un && UN_EMPTY_STEMS.has(un[1]!)) {
      out.push(...rewrite(t, ['without', un[1]!]))
      continue
    }
    out.push(t)
  }
  return rewritePhrases(numberRanges(out))
}

/** "50 to 200", "1k - 5k" with no "between"/"from" before them: an explicit between. */
function numberRanges(tokens: CmdNlToken[]): CmdNlToken[] {
  if (tokens.some((t) => EDIT_VERBS.has(t.word))) return tokens
  const out: CmdNlToken[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const sep = tokens[i + 1]
    const b = tokens[i + 2]
    const prev = out[out.length - 1]?.word
    if (
      !t.quoted &&
      !t.literal &&
      readCmdNumber(t.word) &&
      sep &&
      RANGE_SEPS.has(sep.word) &&
      b &&
      !b.literal &&
      readCmdNumber(b.word) &&
      !RANGE_OPENERS.has(prev ?? '')
    ) {
      out.push(...rewrite(t, ['between']), t, ...rewrite(sep, ['and']), b)
      i += 2
      continue
    }
    out.push(t)
  }
  return out
}

function rewritePhrases(tokens: CmdNlToken[]): CmdNlToken[] {
  const out: CmdNlToken[] = []
  for (let i = 0; i < tokens.length; ) {
    const hit =
      tokens[i]!.quoted || tokens[i]!.literal
        ? undefined
        : PHRASE_REWRITES.find(([phrase]) =>
            phrase.every((p, k) => tokens[i + k]?.word === p && !tokens[i + k]!.quoted && !tokens[i + k]!.literal),
          )
    if (!hit) {
      out.push(tokens[i++]!)
      continue
    }
    const first = tokens[i]!
    const last = tokens[i + hit[0].length - 1]!
    out.push(...hit[1].map((word) => ({ text: word, word, start: first.start, end: last.end })))
    i += hit[0].length
  }
  return out
}

/* ------------------------------------------------------------------------------- phrase match */

/** Longest phrase from `phrases` at token `i` (exact words; typos only on words of 5+ letters). */
export function phraseAt<T>(words: string[], i: number, phrases: Array<[string[], T]>, fuzzy = false) {
  let best: { value: T; end: number; score: number } | undefined
  for (const [phrase, value] of phrases) {
    if (best && phrase.length <= best.end - i) continue
    let score = 1
    let ok = true
    for (let k = 0; k < phrase.length; k++) {
      const typed = words[i + k]
      const want = phrase[k]!
      if (typed === want) continue
      if (fuzzy && typed && want.length >= 5 && typed.length >= 5 && editOne(typed, want)) {
        score *= 0.8
        continue
      }
      ok = false
      break
    }
    if (ok && (!best || phrase.length > best.end - i)) best = { value, end: i + phrase.length, score }
  }
  return best
}

function editOne(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  if (a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)) return true
  // Neighbours swapped: "gretaer" / "greater".
  return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)
}

/* ------------------------------------------------------------------------------------ numbers */

/** A number at token i ("10k", "1,000", "ten", "5 thousand"), with how many tokens it used. */
export function numberAt(tokens: CmdNlToken[], i: number): { value: number; end: number; percent?: boolean } | undefined {
  const t = tokens[i]
  if (!t || t.quoted) return
  const n = readCmdNumber(t.word)
  if (!n) return
  const next = tokens[i + 1]?.word
  const scale = next ? { thousand: 1e3, million: 1e6, billion: 1e9, k: 1e3, hundred: 1e2 }[next] : undefined
  if (scale && !n.percent) return { value: n.value * scale, end: i + 2 }
  if (next === '%' || next === 'percent') return { value: n.value, end: i + 2, percent: true }
  return { value: n.value, end: i + 1, percent: n.percent }
}

/* -------------------------------------------------------------------------------------- dates */

let chrono: typeof ChronoEn | undefined
let chronoLoading: Promise<void> | undefined

/** Loads chrono-node's English parser on demand; dates fall back to ISO/"oct 1" forms until it lands. */
export function loadCmdNlDates(): Promise<void> {
  chronoLoading ??= import('chrono-node/en').then((mod) => {
    chrono = mod
  })
  return chronoLoading
}

export function isCmdNlDatesLoaded() {
  return !!chrono
}

export interface CmdNlDateHit {
  value: Scalar
  end: number
}

/** "today", "2026-10-01", "oct 1", "1 oct", "next friday" (chrono) at token i, as a day scalar. */
export function dateAt(tokens: CmdNlToken[], i: number, now: dayjs.Dayjs): CmdNlDateHit | undefined {
  const t = tokens[i]
  if (!t || t.quoted) return
  const dayWord = DATE_DAY_WORDS[t.word]
  if (dayWord) return { value: { relative: dayWord }, end: i + 1 }
  const period = periodAt(tokens, i, now)
  if (period) return period
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.word) && dayjs(t.word).isValid()) {
    return { value: { date: t.word, precision: 'day' }, end: i + 1 }
  }
  // "oct 1", "october 1st", "1 oct"
  const mon = (w?: string) => (w ? MONTHS.indexOf(w.slice(0, 3)) : -1)
  const dayNum = (w?: string) => (w && /^\d{1,2}(st|nd|rd|th)?$/.test(w) ? parseInt(w, 10) : undefined)
  const fromParts = (m: number, d: number, end: number) => {
    let year = now.year()
    const yearTok = tokens[end]?.word
    if (yearTok && /^\d{4}$/.test(yearTok)) {
      year = parseInt(yearTok, 10)
      end++
    }
    const date = dayjs(new Date(year, m, d))
    return date.isValid() && date.date() === d
      ? { value: { date: date.format('YYYY-MM-DD'), precision: 'day' as const }, end }
      : undefined
  }
  if (mon(t.word) >= 0 && /^[a-z]+$/.test(t.word)) {
    const d = dayNum(tokens[i + 1]?.word)
    if (d) return fromParts(mon(t.word), d, i + 2)
  }
  const d = dayNum(t.word)
  if (d && mon(tokens[i + 1]?.word) >= 0) return fromParts(mon(tokens[i + 1]!.word), d, i + 2)

  // Only words go to chrono: "+1w" or "10k" are edits and numbers, not dates.
  if (!chrono || !/^[a-z]/.test(t.word)) return
  // chrono over the rest of the query; only a single date that starts at this token counts.
  const rest = tokens
    .slice(i)
    .map((tok) => tok.text)
    .join(' ')
  const hit = chrono.parse(rest, now.toDate())[0]
  if (!hit || hit.index !== 0 || hit.end) return
  const covered = hit.text.trim().split(/\s+/).length
  return { value: { date: dayjs(hit.start.date()).format('YYYY-MM-DD'), precision: 'day' }, end: i + covered }
}

const PERIOD_UNITS = new Set(['week', 'month', 'year', 'quarter'])
// Where a period means its first day ("since sep") or its last ("until sep"); elsewhere the whole range.
const PERIOD_START_WORDS = new Set(['since', 'from', 'before', 'starting', '<', '>='])
const PERIOD_END_WORDS = new Set(['until', 'till', 'by', 'after', 'through', '<=', '>'])
const PERIOD_IN_WORDS = new Set(['in', 'during', 'for', 'of', 'within'])

const day = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD')

/**
 * Calendar periods: "this week/month/quarter/year", "next/last quarter", "sep 2026", "september",
 * "in 2025". A range by default; its first or last day after "since"/"until"-style words.
 */
function periodAt(tokens: CmdNlToken[], i: number, now: dayjs.Dayjs): CmdNlDateHit | undefined {
  const w = (k: number) => tokens[k]?.word
  const prev = w(i - 1) ?? ''
  const shape = (from: dayjs.Dayjs, to: dayjs.Dayjs, end: number): CmdNlDateHit => {
    if (PERIOD_START_WORDS.has(prev)) return { value: { date: day(from), precision: 'day' }, end }
    if (PERIOD_END_WORDS.has(prev)) return { value: { date: day(to), precision: 'day' }, end }
    return { value: { range: [day(from), day(to)] }, end }
  }
  const quarterOf = (d: dayjs.Dayjs) => {
    const first = d.month() - (d.month() % 3)
    const from = d.month(first).startOf('month')
    return [from, from.add(2, 'month').endOf('month')] as const
  }

  const which = w(i)
  const unit = w(i + 1)
  if (which && unit && PERIOD_UNITS.has(unit)) {
    const shift =
      which === 'this' || which === 'current'
        ? 0
        : which === 'next'
        ? 1
        : ['last', 'previous', 'prior'].includes(which)
        ? -1
        : undefined
    // Rolling "next/last week|month|year" stays with windowAt; only quarters shift here.
    if (shift === undefined || (shift !== 0 && unit !== 'quarter')) return
    if (unit === 'quarter') {
      const [from, to] = quarterOf(now.add(shift * 3, 'month'))
      return shape(from, to, i + 2)
    }
    if (unit === 'week') {
      // ISO weeks, Monday to Sunday.
      const monday = now.startOf('day').subtract((now.day() + 6) % 7, 'day')
      return shape(monday, monday.add(6, 'day'), i + 2)
    }
    const u = unit as 'month' | 'year'
    return shape(now.startOf(u), now.endOf(u), i + 2)
  }

  const month = which ? MONTH_NAMES[which] : undefined
  if (month !== undefined && !/^\d{1,2}(st|nd|rd|th)?$/.test(unit ?? '')) {
    const hasYear = /^\d{4}$/.test(unit ?? '')
    // "may" is usually the verb: only a month with a year or after "in"/"since"-style words.
    if (which === 'may' && !hasYear && !PERIOD_IN_WORDS.has(prev) && !PERIOD_START_WORDS.has(prev) && !PERIOD_END_WORDS.has(prev))
      return
    const year = hasYear ? parseInt(unit!, 10) : now.year()
    const from = dayjs(new Date(year, month, 1))
    return shape(from, from.endOf('month'), i + (hasYear ? 2 : 1))
  }

  if (
    which &&
    /^(19|20)\d{2}$/.test(which) &&
    (PERIOD_IN_WORDS.has(prev) || PERIOD_START_WORDS.has(prev) || PERIOD_END_WORDS.has(prev))
  ) {
    const from = dayjs(new Date(parseInt(which, 10), 0, 1))
    return shape(from, from.endOf('year'), i + 1)
  }
}

/** Relative windows: "next 7 days", "the past month", "last 30 days", "next week", "this week". */
export function windowAt(
  tokens: CmdNlToken[],
  i: number,
): { value: { relative: CmdNlRelativeDate; n?: number }; end: number } | undefined {
  let j = i
  const w = (k: number) => tokens[k]?.word
  let within = false
  while (['in', 'within', 'during', 'over', 'for', 'the'].includes(w(j) ?? '')) within ||= w(j++) === 'within'
  const dir = w(j)
  const past = dir === 'past' || dir === 'last' || dir === 'previous' || dir === 'prior'
  // "within 3 days" with no direction looks ahead.
  const next = dir === 'next' || dir === 'coming' || dir === 'upcoming' || dir === 'following' || (within && !past)
  if (!past && !next) return
  if (past || dir === 'next' || dir === 'coming' || dir === 'upcoming' || dir === 'following') j++
  let n = 1
  const num =
    w(j) !== undefined
      ? readCmdNumber(w(j)!) ?? (WORD_NUMBERS[w(j)!] !== undefined ? { value: WORD_NUMBERS[w(j)!]! } : undefined)
      : undefined
  if (num) {
    n = num.value
    j++
  }
  const unit = w(j)
  if (!unit) return
  const days = { day: 1, days: 1, week: 7, weeks: 7, fortnight: 14, month: 30, months: 30, year: 365, years: 365 }[unit]
  if (days === undefined) return
  j++
  if (!num && (unit === 'week' || unit === 'month' || unit === 'year')) {
    const rel = `${past ? 'past' : 'next'}${unit[0]!.toUpperCase()}${unit.slice(1)}` as CmdNlRelativeDate
    return { value: { relative: rel }, end: j }
  }
  if (num && (unit === 'month' || unit === 'months') && n === 1)
    return { value: { relative: past ? 'pastMonth' : 'nextMonth' }, end: j }
  return { value: { relative: past ? 'pastNumberOfDays' : 'nextNumberOfDays', n: n * days }, end: j }
}

/** "next friday", "this monday": a weekday relative to now. */
export function weekdayAt(tokens: CmdNlToken[], i: number, now: dayjs.Dayjs): CmdNlDateHit | undefined {
  const which = tokens[i]?.word
  const day = WEEKDAY_NAMES[tokens[i + 1]?.word ?? '']
  if (day === undefined || !['next', 'this', 'last', 'coming'].includes(which ?? '')) return
  let date = now.startOf('day').day(day)
  if (which === 'next' || which === 'coming') date = date.isAfter(now, 'day') ? date : date.add(1, 'week')
  if (which === 'last') date = date.isBefore(now, 'day') ? date : date.subtract(1, 'week')
  return { value: { date: date.format('YYYY-MM-DD'), precision: 'day' }, end: i + 2 }
}

/* -------------------------------------------------------------------------------------- spans */

/** Words as the vocabulary sees them, one per token. */
export const cmdNlWordList = (tokens: CmdNlToken[]) => tokens.map((t) => t.word)

const span = (tokens: CmdNlToken[], i: number, end: number, tag: CmdNlTag, ref?: string, score = 1): Span => ({
  start: tokens[i]!.start,
  end: tokens[end - 1]!.end,
  tag,
  ref,
  score,
})

/**
 * Every typed span the vocabulary and lexicon recognise, longest first at each position (Duckling-style:
 * overlapping candidates; the parser picks). Used for chips, the tagger's teacher labels and debugging.
 */
export function extractCmdNlSpans(tokens: CmdNlToken[], lex: CmdNlLexicon, now: dayjs.Dayjs): Span[] {
  const words = cmdNlWordList(tokens)
  const spans: Span[] = []
  for (let i = 0; i < tokens.length; i++) {
    for (const m of cmdNlLexAt(lex, words, i)) {
      spans.push(span(tokens, i, m.end, m.entry.kind === 'field' ? 'field' : 'value', m.entry.value ?? m.entry.fieldId, m.score))
    }
    const win = windowAt(tokens, i)
    if (win) spans.push(span(tokens, i, win.end, 'date', win.value.relative))
    const date = dateAt(tokens, i, now)
    if (date) spans.push(span(tokens, i, date.end, 'date'))
    const num = numberAt(tokens, i)
    if (num && !date) spans.push(span(tokens, i, num.end, 'num', String(num.value)))
    const cmp = phraseAt(words, i, CMP_PHRASES, true)
    if (cmp) spans.push(span(tokens, i, cmp.end, 'cmp', cmp.value, cmp.score))
    const agg = phraseAt(words, i, AGG_WORDS)
    if (agg) spans.push(span(tokens, i, agg.end, 'agg', agg.value))
    const word = words[i]!
    if (NEGATIONS.has(word)) spans.push(span(tokens, i, i + 1, 'neg'))
    if (CONJUNCTIONS[word] || word === ',') spans.push(span(tokens, i, i + 1, 'conj', CONJUNCTIONS[word] ?? 'and'))
    if (SORT_VERBS.has(word) || GROUP_VERBS.has(word) || LIMIT_WORDS.has(word) || PER_WORDS.has(word) || SORT_DIRECTIONS[word]) {
      spans.push(span(tokens, i, i + 1, 'verb', word))
    }
    if (GLUE_WORDS.has(word) || lex.tableNouns.has(word)) spans.push(span(tokens, i, i + 1, 'filler'))
  }
  return spans
}
