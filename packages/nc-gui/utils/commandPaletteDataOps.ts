import dayjs from 'dayjs'

/* ------------------------------------------------------------------------------------------------
 * Calculator: "= 2500 * 1.18", "(10 + 5) / 3". A recursive-descent evaluator; never eval/Function.
 * ---------------------------------------------------------------------------------------------- */

type CalcToken = { kind: 'num'; value: number } | { kind: 'op'; value: string }

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6 }

function tokenizeCalc(input: string): CalcToken[] | undefined {
  const tokens: CalcToken[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    // 1,000 groups only (a comma followed by exactly three digits), decimals, then an optional k/m.
    const num = /^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?/.exec(input.slice(i))![0]
    if (num && /\d/.test(num)) {
      i += num.length
      let value = Number(num.replace(/,/g, ''))
      const suffix = input[i]?.toLowerCase()
      if (suffix && SUFFIX[suffix] && !/[a-z]/i.test(input[i + 1] ?? '')) {
        value *= SUFFIX[suffix]!
        i++
      }
      tokens.push({ kind: 'num', value })
      continue
    }
    if ('+-*/%^()×÷'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch === '×' ? '*' : ch === '÷' ? '/' : ch })
      i++
      continue
    }
    return undefined
  }
  return tokens
}

function evaluateTokens(tokens: CalcToken[]): number | undefined {
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (value: string) => peek()?.kind === 'op' && peek()!.value === value
  // `%` before a number or "(" is modulo ("10 % 3"); otherwise it's a postfix percent ("200 * 10%").
  const startsOperand = (token?: CalcToken) => token?.kind === 'num' || (token?.kind === 'op' && token.value === '(')

  function expression(): number {
    let value = term()
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++]!.value
      const right = term()
      value = op === '+' ? value + right : value - right
    }
    return value
  }

  function term(): number {
    let value = unary()
    while (isOp('*') || isOp('/') || (isOp('%') && startsOperand(tokens[pos + 1]))) {
      const op = tokens[pos++]!.value
      const right = unary()
      value = op === '*' ? value * right : op === '/' ? value / right : value % right
    }
    return value
  }

  function unary(): number {
    if (isOp('-')) {
      pos++
      return -unary()
    }
    if (isOp('+')) {
      pos++
      return unary()
    }
    return power()
  }

  function power(): number {
    const base = postfix()
    if (isOp('^')) {
      pos++
      return base ** unary()
    }
    return base
  }

  function postfix(): number {
    let value = primary()
    while (isOp('%') && !startsOperand(tokens[pos + 1])) {
      pos++
      value /= 100
    }
    return value
  }

  function primary(): number {
    const token = tokens[pos++]
    if (token?.kind === 'num') return token.value
    if (token?.kind === 'op' && token.value === '(') {
      const value = expression()
      if (!isOp(')')) throw new Error('unbalanced')
      pos++
      return value
    }
    throw new Error('operand expected')
  }

  try {
    const value = expression()
    if (pos !== tokens.length) return undefined
    return Number.isFinite(value) ? value : undefined
  } catch {
    return undefined
  }
}

export interface CmdCalcResult {
  value: number
  expression: string
  /** Grouped for display ("2,950.5"). */
  display: string
  /** Ungrouped, for the clipboard ("2950.5"). */
  copy: string
}

/**
 * "= expr" always; a bare expression only when it is two or more numbers joined by an operator,
 * with no letters but k/m suffixes, so "+1w", "add 10" or "-5%" stay with relative edits.
 */
export function evaluateCmdCalc(query: string): CmdCalcResult | undefined {
  const trimmed = query.trim()
  const explicit = trimmed.startsWith('=')
  const expression = (explicit ? trimmed.slice(1) : trimmed).trim()
  if (!expression) return

  if (!explicit) {
    if (/[a-jl-z]/i.test(expression.replace(/(\d)[km](?![a-z])/gi, '$1'))) return
    // A date ("2026-10-14") or a lone signed number isn't a calculation.
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(expression)) return
    if (!/\d[\d.,km\s%]*\s*[-+*/%^×÷]\s*[(\-+]*\s*\d/i.test(expression)) return
  }

  const tokens = tokenizeCalc(expression)
  if (!tokens?.length) return
  const raw = evaluateTokens(tokens)
  if (raw === undefined) return

  // Twelve significant digits drop float noise (0.1 + 0.2 → 0.3).
  const value = Number(raw.toPrecision(12))
  return {
    value,
    expression,
    display: value.toLocaleString('en-US', { maximumFractionDigits: 10 }),
    copy: String(value),
  }
}

/* ------------------------------------------------------------------------------------------------
 * Quick stats: "sum of amount", "avg score where city is austin", "count where stage is won".
 * ---------------------------------------------------------------------------------------------- */

export type CmdStatKind = 'number' | 'date' | 'checkbox' | 'select' | 'user' | 'text'

export interface CmdStatColumn {
  id: string
  title: string
  kind: CmdStatKind
  /** Aggregations the footer offers for this column (getAvailableAggregations). */
  aggregations: string[]
  /** Select option titles. */
  options?: string[]
}

export interface CmdStatCondition {
  column: CmdStatColumn
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'blank' | 'notblank' | 'checked' | 'notchecked' | 'anyof'
  value?: string
}

export interface CmdStatQuery {
  aggregation: string
  /** Absent for a plain record count. */
  column?: CmdStatColumn
  where: CmdStatCondition[]
}

type StatAgg = 'sum' | 'avg' | 'min' | 'max' | 'median' | 'range' | 'count' | 'count_unique' | 'count_empty' | 'count_filled'

/** Longest phrases first, so "number of" wins over "number". */
const AGG_WORDS: Array<[string[], StatAgg]> = [
  [['how', 'many'], 'count'],
  [['number', 'of'], 'count'],
  [['count', 'unique'], 'count_unique'],
  [['count', 'distinct'], 'count_unique'],
  [['count', 'empty'], 'count_empty'],
  [['count', 'filled'], 'count_filled'],
  [['sum'], 'sum'],
  [['total'], 'sum'],
  [['average'], 'avg'],
  [['avg'], 'avg'],
  [['mean'], 'avg'],
  [['median'], 'median'],
  [['min'], 'min'],
  [['minimum'], 'min'],
  [['lowest'], 'min'],
  [['smallest'], 'min'],
  [['earliest'], 'min'],
  [['max'], 'max'],
  [['maximum'], 'max'],
  [['highest'], 'max'],
  [['largest'], 'max'],
  [['latest'], 'max'],
  [['range'], 'range'],
  [['count'], 'count'],
  [['unique'], 'count_unique'],
  [['distinct'], 'count_unique'],
]

const OP_WORDS: Array<[string[], CmdStatCondition['op']]> = [
  [['is', 'not', 'empty'], 'notblank'],
  [['is', 'not', 'blank'], 'notblank'],
  [['is', 'filled'], 'notblank'],
  [['is', 'empty'], 'blank'],
  [['is', 'blank'], 'blank'],
  [['is', 'unchecked'], 'notchecked'],
  [['is', 'not', 'checked'], 'notchecked'],
  [['is', 'checked'], 'checked'],
  [['greater', 'than', 'or', 'equal', 'to'], 'gte'],
  [['less', 'than', 'or', 'equal', 'to'], 'lte'],
  [['greater', 'than'], 'gt'],
  [['more', 'than'], 'gt'],
  [['less', 'than'], 'lt'],
  [['fewer', 'than'], 'lt'],
  [['at', 'least'], 'gte'],
  [['at', 'most'], 'lte'],
  [['is', 'not'], 'neq'],
  [["isn't"], 'neq'],
  [['not'], 'neq'],
  [['!='], 'neq'],
  [['>='], 'gte'],
  [['<='], 'lte'],
  [['>'], 'gt'],
  [['<'], 'lt'],
  [['above'], 'gt'],
  [['over'], 'gt'],
  [['below'], 'lt'],
  [['under'], 'lt'],
  [['contains'], 'like'],
  [['includes'], 'like'],
  [['has'], 'like'],
  [['like'], 'like'],
  [['equals'], 'eq'],
  [['=='], 'eq'],
  [['='], 'eq'],
  [['is'], 'eq'],
]

const NUMERIC_OPS = new Set(['gt', 'lt', 'gte', 'lte'])

function startsWithWords(words: string[], at: number, phrase: string[]) {
  return phrase.every((word, i) => words[at + i] === word)
}

function wordsOf(text: string) {
  return text
    .toLowerCase()
    .replace(/[?!,]/g, ' ')
    .replace(/(>=|<=|!=|==|[<>=])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean)
}

/** A field title typed as its words, a plural, or a prefix of each word ("amt" doesn't count, "amou" does). */
function titleWordMatches(typed: string, titleWord: string) {
  if (typed === titleWord || typed === `${titleWord}s` || `${typed}s` === titleWord) return true
  return typed.length >= 3 && titleWord.startsWith(typed)
}

/** The column whose title words start at `at`, longest title first; returns it and the words used. */
function matchColumnAt(words: string[], at: number, columns: CmdStatColumn[]) {
  let best: { column: CmdStatColumn; length: number } | undefined
  for (const column of columns) {
    const titleWords = wordsOf(column.title)
    if (!titleWords.length || at + titleWords.length > words.length) continue
    if (titleWords.every((word, i) => titleWordMatches(words[at + i]!, word))) {
      if (!best || titleWords.length > best.length) best = { column, length: titleWords.length }
    }
  }
  return best
}

function matchOption(column: CmdStatColumn, value: string) {
  const needle = value.trim().toLowerCase()
  return column.options?.find((option) => option.toLowerCase() === needle)
}

function parseCondition(words: string[], original: string[], columns: CmdStatColumn[]): CmdStatCondition | undefined {
  const field = matchColumnAt(words, 0, columns)
  if (!field) {
    // A bare option ("won") reads as "<the one select field that has it> is won".
    const value = original.join(' ')
    const owners = columns.filter((column) => column.kind === 'select' && matchOption(column, value))
    return owners.length === 1 ? { column: owners[0]!, op: 'eq', value: matchOption(owners[0]!, value) } : undefined
  }

  const { column } = field
  let at = field.length
  const opMatch = OP_WORDS.find(([phrase]) => startsWithWords(words, at, phrase))
  // "stage won" with no verb reads as "is".
  const op = opMatch?.[1] ?? 'eq'
  at += opMatch?.[0].length ?? 0
  const value = original.slice(at).join(' ').trim()

  if (op === 'blank' || op === 'notblank') return value ? undefined : { column, op }
  if (op === 'checked' || op === 'notchecked') return column.kind === 'checkbox' && !value ? { column, op } : undefined
  if (!value) return
  if (NUMERIC_OPS.has(op) && column.kind !== 'number' && column.kind !== 'date') return
  if (NUMERIC_OPS.has(op) && column.kind === 'number' && !Number.isFinite(Number(value.replace(/,/g, '')))) return

  if (column.kind === 'select') {
    if (op !== 'eq' && op !== 'neq') return
    const option = matchOption(column, value)
    return option ? { column, op, value: option } : undefined
  }
  if (column.kind === 'user') {
    return value.toLowerCase() === 'me' && op === 'eq' ? { column, op: 'anyof', value: '@me' } : undefined
  }
  if (column.kind === 'checkbox') {
    const truthy = /^(true|yes|checked|done|1)$/i.test(value)
    const falsy = /^(false|no|unchecked|0)$/i.test(value)
    if (!truthy && !falsy) return
    return { column, op: (op === 'neq') === truthy ? 'notchecked' : 'checked' }
  }
  // Dates compare by exact day only through the filter menu's sub-ops; keep date where-clauses to empty checks.
  if (column.kind === 'date') return

  return { column, op, value: column.kind === 'number' ? value.replace(/,/g, '') : value }
}

const DATE_AGG: Partial<Record<StatAgg, string>> = { min: 'earliest_date', max: 'latest_date', range: 'date_range' }

/** Parses "<aggregation> [of] [<field>] [where <condition> [and <condition>…]]"; undefined when it isn't one. */
export function parseCmdStatsQuery(query: string, columns: CmdStatColumn[]): CmdStatQuery | undefined {
  const original = query.replace(/[?!,]/g, ' ').trim().split(/\s+/).filter(Boolean)
  const words = original.map((word) => word.toLowerCase())
  if (!words.length) return

  const aggEntry = AGG_WORDS.find(([phrase]) => startsWithWords(words, 0, phrase))
  let agg: StatAgg | undefined = aggEntry?.[1]
  let at = aggEntry?.[0].length ?? 0
  const isHowMany = agg === 'count'
  if (words[at] === 'of' || words[at] === 'the') at++
  if (words[at] === 'the') at++

  let column: CmdStatColumn | undefined
  if (agg) {
    const field = matchColumnAt(words, at, columns)
    if (field) {
      column = field.column
      at += field.length
    }
  } else {
    // "<field> <agg>": "amount total", "score average".
    const field = matchColumnAt(words, 0, columns)
    if (!field) return
    const trailing = AGG_WORDS.find(([phrase]) => startsWithWords(words, field.length, phrase))
    if (!trailing || trailing[1] === 'count' || field.length + trailing[0].length !== words.length) return
    agg = trailing[1]
    column = field.column
    at = words.length
  }

  // "how many deals are won", "count deals where …": up to two words naming the records, then the condition.
  if (isHowMany && !column) {
    const from = at
    while (at < words.length && at - from < 2 && !['are', 'is', 'where', 'with', 'that', 'which'].includes(words[at]!)) at++
    if (at < words.length && !['are', 'is', 'where', 'with', 'that', 'which'].includes(words[at]!)) at = from
    if (words[at] === 'are' || words[at] === 'is') at++
  }

  const where: CmdStatCondition[] = []
  if (at < words.length) {
    if (['where', 'with', 'when', 'for', 'if', 'whose', 'that', 'which'].includes(words[at]!)) at++
    else if (!isHowMany) return
    const clauseWords = words.slice(at)
    const clauseOriginal = original.slice(at)
    if (!clauseWords.length) return
    // "and" splits clauses; "or" isn't supported.
    if (clauseWords.includes('or')) return
    let start = 0
    for (let i = 0; i <= clauseWords.length; i++) {
      if (i === clauseWords.length || clauseWords[i] === 'and') {
        const condition = parseCondition(clauseWords.slice(start, i), clauseOriginal.slice(start, i), columns)
        if (!condition) return
        where.push(condition)
        start = i + 1
      }
    }
  }

  if (agg === 'count' && !column) return { aggregation: 'count', where }
  if (!column) return

  let aggregation: string = agg!
  if (column.kind === 'date' && DATE_AGG[agg!]) aggregation = DATE_AGG[agg!]!
  if (agg === 'count') aggregation = 'count_filled'
  if (!column.aggregations.includes(aggregation)) return
  return { aggregation, column, where }
}

/* ------------------------------------------------------------------------------------------------
 * Quick create: "new deal Acme 5000 won", "add record Cedar Retail Austin 30", "new deal stage: won, amount: 5k".
 * ---------------------------------------------------------------------------------------------- */

export type CmdCreateKind = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multiselect' | 'user' | 'checkbox' | 'other'

export interface CmdCreateColumn {
  title: string
  kind: CmdCreateKind
  /** Display (primary) column. */
  pv?: boolean
  /** Must be set on insert (required and no default). */
  required?: boolean
  options?: string[]
  /** Rating maximum. */
  max?: number
}

export interface CmdCreatePlan {
  /** Insert payload keyed by column title. */
  values: Record<string, unknown>
  /** What goes where, in column order, for the preview. */
  pairs: Array<{ column: CmdCreateColumn; display: string }>
  missingRequired: string[]
  /** Why the plan can't be inserted as typed. */
  error?: string
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseCreateNumber(token: string) {
  const match = /^[$€£₹¥]?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)([km])?%?$/i.exec(token)
  if (!match) return
  const value = Number(match[1]!.replace(/,/g, '')) * (match[2] ? SUFFIX[match[2].toLowerCase()]! : 1)
  return Number.isFinite(value) ? value : undefined
}

/** today / tomorrow / yesterday / 2026-10-20 / "oct 20" / "20 oct": returns the day and how many tokens it used. */
function parseCreateDate(tokens: string[], at: number, now: dayjs.Dayjs) {
  const word = tokens[at]!.toLowerCase()
  if (word === 'today') return { date: now.startOf('day'), used: 1 }
  if (word === 'tomorrow') return { date: now.add(1, 'day').startOf('day'), used: 1 }
  if (word === 'yesterday') return { date: now.subtract(1, 'day').startOf('day'), used: 1 }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(word)) {
    const date = dayjs(word, 'YYYY-M-D')
    return date.isValid() ? { date, used: 1 } : undefined
  }
  const next = tokens[at + 1]?.toLowerCase()
  const monthOf = (text?: string) => (text ? MONTHS.indexOf(text.slice(0, 3)) : -1)
  const dayOf = (text?: string) => (text && /^\d{1,2}(st|nd|rd|th)?$/.test(text) ? parseInt(text, 10) : NaN)
  for (const [monthText, dayText] of [
    [word, next],
    [next, word],
  ] as const) {
    const month = monthOf(monthText)
    const day = dayOf(dayText)
    if (month >= 0 && monthText && monthText.length >= 3 && /^[a-z]+$/.test(monthText) && day >= 1 && day <= 31) {
      const date = now.month(month).date(day).startOf('day')
      return date.month() === month ? { date, used: 2 } : undefined
    }
  }
}

function matchCreateColumn(name: string, columns: CmdCreateColumn[]) {
  const needle = name.trim().toLowerCase()
  return (
    columns.find((column) => column.title.toLowerCase() === needle) ??
    columns.find((column) => column.title.toLowerCase().startsWith(needle) && needle.length >= 3)
  )
}

/** Splits on spaces but keeps "…", “…” and '…' together, unquoted. */
function createTokens(text: string) {
  return [...text.matchAll(/"([^"]*)"|“([^”]*)”|'([^']*)'|(\S+)/g)].map((match) => ({
    text: match[1] ?? match[2] ?? match[3] ?? match[4]!,
    quoted: match[4] === undefined,
  }))
}

function singularForms(word: string) {
  const lower = word.toLowerCase()
  return new Set([lower, lower.replace(/s$/, ''), `${lower}s`, lower.replace(/ies$/, 'y'), lower.replace(/y$/, 'ies')])
}

/**
 * Reads "new <table> …", "new record …" or "add record …" and maps the rest onto the table's columns.
 * Undefined when the query isn't a quick create (so "new workflow Foo" stays a named create).
 */
export function parseCmdQuickCreate(
  query: string,
  ctx: { tableTitle: string; columns: CmdCreateColumn[]; now?: dayjs.Dayjs; currentUserLabel?: string },
): CmdCreatePlan | undefined {
  const text = query.trim()
  const lead = /^(new|add|create)\s+(\S+)(?:\s+(\S+))?\s*/i.exec(text)
  if (!lead) return

  const verb = lead[1]!.toLowerCase()
  const tableWords = ctx.tableTitle.toLowerCase().split(/\s+/)
  const first = lead[2]!.toLowerCase()
  const second = lead[3]?.toLowerCase()
  let consumed: number
  if (first === 'record' || first === 'row') consumed = 1
  else if (verb === 'new' && tableWords.length === 1 && singularForms(tableWords[0]!).has(first)) consumed = 1
  else if (
    verb === 'new' &&
    tableWords.length === 2 &&
    first === tableWords[0] &&
    second &&
    singularForms(tableWords[1]!).has(second)
  )
    consumed = 2
  else return

  const rest = text.replace(new RegExp(`^${lead[1]}\\s+${'\\S+\\s*'.repeat(consumed)}`, 'i'), '').trim()
  if (!rest) return

  const now = ctx.now ?? dayjs()
  const columns = ctx.columns.filter((column) => column.kind !== 'other')
  const values: Record<string, unknown> = {}
  const shown = new Map<string, string>()
  let error: string | undefined

  const assign = (column: CmdCreateColumn, value: unknown, display: string) => {
    values[column.title] = value
    shown.set(column.title, display)
  }

  // "field: value" and "field=value" segments, split on commas, are explicit.
  const free: string[] = []
  for (const segment of rest.split(',')) {
    const pair = /^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/.exec(segment)
    const column = pair ? matchCreateColumn(pair[1]!, columns) : undefined
    if (!pair || !column) {
      free.push(segment)
      continue
    }
    const raw = pair[2]!.replace(/^["“']|["”']$/g, '')
    if (column.kind === 'number') {
      const number = parseCreateNumber(raw)
      if (number === undefined) error = `${column.title}: not a number`
      else assign(column, number, number.toLocaleString('en-US'))
    } else if (column.kind === 'select' || column.kind === 'multiselect') {
      const option = column.options?.find((o) => o.toLowerCase() === raw.toLowerCase())
      if (!option) error = `${column.title}: no option “${raw}”`
      else assign(column, option, option)
    } else if (column.kind === 'date' || column.kind === 'datetime') {
      const tokens = raw.split(/\s+/)
      const date = parseCreateDate(tokens, 0, now)
      if (!date || date.used !== tokens.length) error = `${column.title}: not a date`
      else
        assign(
          column,
          date.date.format(column.kind === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ssZ'),
          date.date.format('MMM D, YYYY'),
        )
    } else if (column.kind === 'checkbox') {
      const on = /^(true|yes|checked|done|1|on)$/i.test(raw)
      assign(column, on, on ? '✓' : '✗')
    } else if (column.kind === 'user') {
      if (raw.toLowerCase() !== 'me') error = `${column.title}: only “me” is supported`
      else assign(column, '@me', ctx.currentUserLabel ?? 'me')
    } else {
      assign(column, raw, `“${raw}”`)
    }
  }

  const tokens = createTokens(free.join(' '))
  const textParts: string[] = []
  const taken = (column: CmdCreateColumn) => values[column.title] !== undefined
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token.quoted) {
      textParts.push(token.text)
      continue
    }
    const lower = token.text.toLowerCase()

    // An option of a select field, longest multi-word option first.
    let optionHit: { column: CmdCreateColumn; option: string; used: number } | undefined
    for (const column of columns) {
      if ((column.kind !== 'select' && column.kind !== 'multiselect') || (column.kind === 'select' && taken(column))) continue
      for (const option of column.options ?? []) {
        const optionWords = option.toLowerCase().split(/\s+/)
        const typed = tokens.slice(i, i + optionWords.length).map((t) => t.text.toLowerCase())
        if (typed.join(' ') === optionWords.join(' ') && (!optionHit || optionWords.length > optionHit.used)) {
          optionHit = { column, option, used: optionWords.length }
        }
      }
    }
    if (optionHit) {
      const { column, option } = optionHit
      if (column.kind === 'multiselect') {
        const list = [...((values[column.title] as string[] | undefined) ?? []), option]
        assign(column, list, list.join(', '))
      } else assign(column, option, option)
      i += optionHit.used - 1
      continue
    }

    if (lower === 'me') {
      const user = columns.find((column) => column.kind === 'user' && !taken(column))
      if (user) {
        assign(user, '@me', ctx.currentUserLabel ?? 'me')
        continue
      }
    }

    const date = parseCreateDate(
      tokens.map((t) => t.text),
      i,
      now,
    )
    const dateColumn = date && columns.find((column) => (column.kind === 'date' || column.kind === 'datetime') && !taken(column))
    if (date && dateColumn) {
      assign(
        dateColumn,
        date.date.format(dateColumn.kind === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ssZ'),
        date.date.format('MMM D, YYYY'),
      )
      i += date.used - 1
      continue
    }

    const number = parseCreateNumber(token.text)
    const numberColumn = number !== undefined ? columns.find((column) => column.kind === 'number' && !taken(column)) : undefined
    if (number !== undefined && numberColumn) {
      if (numberColumn.max !== undefined && (number < 0 || number > numberColumn.max)) {
        error = `${numberColumn.title}: ${number} is outside 0–${numberColumn.max}`
      }
      assign(numberColumn, number, number.toLocaleString('en-US'))
      continue
    }

    textParts.push(token.text)
  }

  // Everything else is the record's name.
  if (textParts.length) {
    const primary = columns.find((column) => column.pv && column.kind === 'text' && !taken(column))
    if (primary) {
      const name = textParts.join(' ')
      assign(primary, name, `“${name}”`)
    } else error ??= `Couldn't place “${textParts.join(' ')}”`
  }

  const pairs = columns
    .filter((column) => shown.has(column.title))
    .map((column) => ({ column, display: shown.get(column.title)! }))
  if (!pairs.length && !error) return
  const missingRequired = ctx.columns
    .filter((column) => column.required && values[column.title] === undefined)
    .map((c) => c.title)
  return { values, pairs, missingRequired, error }
}
