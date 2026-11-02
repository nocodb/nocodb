import dayjs from 'dayjs'
import type { CmdNlToken } from './extract'
import { dateAt, numberAt, phraseAt, tokenizeCmdNl, windowAt } from './extract'
import { buildCmdNlLexicon, cmdNlLexAt, cmdNlLiteralGuard } from './lexicon'
import type { CmdNlLexicon } from './lexicon'
import type { CmdNlSchema } from './schema'
import { AGG_WORDS, AGG_WORDS_EXTRA, PERCENT_AGG_WORDS, SHARE_WORDS } from './vocab/aggregations'
import { CMP_PHRASES } from './vocab/comparators'
import { CONJUNCTIONS, GLUE_WORDS } from './vocab/fillers'
import { COLOR_VERBS } from './vocab/colors'
import {
  ADD_WORDS,
  CLEAR_VERBS,
  GROUP_VERBS,
  LIMIT_WORDS,
  MUL_WORDS,
  SET_VERBS,
  SORT_DIRECTIONS,
  SORT_VERBS,
  SUB_WORDS,
} from './vocab/verbs'

/**
 * Chips for a query no reading covers yet: what each recognised word stands for, in typed order, plus a
 * ghost completion of the field name being typed ("company si" → Company Size). Cheap: one lexicon walk.
 */

export type CmdNlSkeletonKind = 'share' | 'agg' | 'noun' | 'field' | 'cmp' | 'value' | 'num' | 'date' | 'verb' | 'text'

export interface CmdNlSkeletonChip {
  kind: CmdNlSkeletonKind
  /** As typed, except fields and values, which show their real title. */
  text: string
  /** Field id, option, member id, aggregation or comparator the words were linked to. */
  ref?: string
  /** For values: the field holding them. */
  fieldId?: string
  /** Source range in the query. */
  from: number
  to: number
}

export interface CmdNlSkeletonGhost {
  fieldId: string
  title: string
  /** The completion replaces query.slice(from). */
  from: number
}

export interface CmdNlSkeleton {
  chips: CmdNlSkeletonChip[]
  ghost?: CmdNlSkeletonGhost
}

const AGGS = [...AGG_WORDS, ...AGG_WORDS_EXTRA]

/** Words that join the parts of a query; shown as plain text between chips. */
const CONNECTORS = new Set(['where', 'with', 'whose', 'that', 'which', 'of', 'for', 'by', 'in', 'from', 'to', 'as', 'per'])

const VERBS = new Set([
  ...SET_VERBS,
  ...CLEAR_VERBS,
  ...SORT_VERBS,
  ...GROUP_VERBS,
  ...COLOR_VERBS,
  ...ADD_WORDS,
  ...SUB_WORDS,
  ...MUL_WORDS,
  'new',
  'create',
  'mark',
  'assign',
  'fill',
  'tag',
])

/** Whether `word` is vocabulary of its own (a comparator, verb, joiner…), so it isn't a field being typed. */
function isVocab(word: string) {
  return (
    CONNECTORS.has(word) ||
    VERBS.has(word) ||
    GLUE_WORDS.has(word) ||
    !!CONJUNCTIONS[word] ||
    CMP_PHRASES.some(([phrase]) => phrase[0] === word) ||
    AGGS.some(([phrase]) => phrase[0] === word)
  )
}

/** The field title the trailing typed words begin ("company si" → Company Size, "rev" → Annual Revenue). */
function ghostOf(query: string, schema: CmdNlSchema): CmdNlSkeletonGhost | undefined {
  if (!query || /\s$/.test(query)) return
  const words = [...query.matchAll(/\S+/g)]
  const last = words[words.length - 1]!
  const partial = last[0].toLowerCase()
  for (let n = Math.min(3, words.length); n > 0; n--) {
    const from = words[words.length - n]!.index!
    const tail = query.slice(from).toLowerCase()
    if (tail.length < 2 || (n === 1 && isVocab(partial))) continue
    // Whole-title prefix first ("company si"), then a later title word ("rev" → Annual Revenue).
    const prefix = schema.fields
      .filter((f) => f.title.toLowerCase().startsWith(tail) && f.title.toLowerCase() !== tail)
      .sort((a, b) => Number(!!a.system) - Number(!!b.system) || a.title.length - b.title.length)[0]
    if (prefix) return { fieldId: prefix.id, title: prefix.title, from }
    if (n > 1 || partial.length < 3) continue
    const inner = schema.fields
      .filter(
        (f) =>
          f.title.toLowerCase() !== partial &&
          f.title
            .toLowerCase()
            .split(/\s+/)
            .some((w) => w.startsWith(partial)),
      )
      .sort((a, b) => a.title.length - b.title.length)[0]
    if (inner) return { fieldId: inner.id, title: inner.title, from }
  }
}

function lexChip(lex: CmdNlLexicon, tokens: CmdNlToken[], words: string[], i: number): [CmdNlSkeletonChip, number] | undefined {
  const match = cmdNlLexAt(lex, words, i)[0]
  if (!match) return
  const word = words[i]!
  // The table's own name ("companies") is the records, not a field whose title merely contains it.
  if (lex.tableNouns.has(word) && match.end === i + 1 && match.entry.quality < 1) return
  const field = lex.schema.fields.find((f) => f.id === match.entry.fieldId)
  if (!field) return
  const range = { from: tokens[i]!.start, to: tokens[match.end - 1]!.end }
  if (match.entry.kind === 'field') return [{ kind: 'field', text: field.title, ref: field.id, ...range }, match.end]
  const member = match.entry.kind === 'member' ? field.members?.find((m) => m.id === match.entry.value) : undefined
  const text = member ? member.name || member.email || member.id : match.entry.value ?? tokens[i]!.text
  return [{ kind: 'value', text, ref: match.entry.value, fieldId: field.id, ...range }, match.end]
}

export function cmdNlSkeleton(
  query: string,
  schema: CmdNlSchema,
  opts: { rows?: Record<string, unknown>[]; now?: dayjs.Dayjs } = {},
): CmdNlSkeleton {
  const lex = buildCmdNlLexicon(schema, opts.rows)
  const tokens = tokenizeCmdNl(query, cmdNlLiteralGuard(lex))
  const words = tokens.map((t) => t.word)
  const now = opts.now ?? dayjs()
  const ghost = ghostOf(query, schema)
  const chips: CmdNlSkeletonChip[] = []
  const joiners = new Set<CmdNlSkeletonChip>()

  const at = (i: number, end: number, kind: CmdNlSkeletonKind, ref?: string): CmdNlSkeletonChip => ({
    kind,
    // Rewritten tokens ("50-200" → between …) keep their source range: show what was typed.
    text: query.slice(tokens[i]!.start, tokens[end - 1]!.end),
    ref,
    from: tokens[i]!.start,
    to: tokens[end - 1]!.end,
  })

  for (let i = 0; i < tokens.length; ) {
    // The ghost stands for the words it completes.
    if (ghost && tokens[i]!.end > ghost.from) break
    const word = words[i]!
    // "top 5", "first 10": a limit, not the "top value" aggregation.
    if (LIMIT_WORDS.has(word) && words[i + 1] !== 'value') {
      chips.push(at(i, i + 1, 'verb', word))
      i++
      continue
    }
    const share = phraseAt(words, i, SHARE_WORDS)
    const percent = phraseAt(words, i, PERCENT_AGG_WORDS)
    if (percent) {
      chips.push(at(i, percent.end, 'agg', percent.value))
      i = percent.end
      continue
    }
    if (share) {
      chips.push(at(i, share.end, 'share'))
      i = share.end
      continue
    }
    const agg = phraseAt(words, i, AGGS)
    if (agg) {
      chips.push(at(i, agg.end, 'agg', agg.value))
      i = agg.end
      continue
    }
    const linked = lexChip(lex, tokens, words, i)
    if (linked) {
      chips.push(linked[0])
      i = linked[1]
      continue
    }
    if (lex.tableNouns.has(word)) {
      chips.push(at(i, i + 1, 'noun'))
      i++
      continue
    }
    const cmp = phraseAt(words, i, CMP_PHRASES)
    if (cmp) {
      chips.push(at(i, cmp.end, 'cmp', cmp.value))
      i = cmp.end
      continue
    }
    const date = windowAt(tokens, i) ?? dateAt(tokens, i, now)
    if (date) {
      chips.push(at(i, date.end, 'date'))
      i = date.end
      continue
    }
    const num = numberAt(tokens, i)
    if (num) {
      chips.push(at(i, num.end, 'num', String(num.value)))
      i = num.end
      continue
    }
    if (VERBS.has(word) || LIMIT_WORDS.has(word) || SORT_DIRECTIONS[word]) chips.push(at(i, i + 1, 'verb', word))
    // Joiners and words nothing recognises ("Acme") stay as plain text, so the chips keep typed order.
    else if (CONNECTORS.has(word) || CONJUNCTIONS[word]) joiners.add(chips[chips.push(at(i, i + 1, 'text')) - 1]!)
    else if (!GLUE_WORDS.has(word)) chips.push(at(i, i + 1, 'text'))
    i++
  }

  // A trailing joiner with nothing after it says nothing yet; a skeleton of plain text alone says nothing.
  if (!ghost) while (chips.length && joiners.has(chips[chips.length - 1]!)) chips.pop()
  const said = chips.some((c) => c.kind !== 'text')
  if (!said && !ghost) return { chips: [] }
  return ghost ? { chips, ghost } : { chips }
}
