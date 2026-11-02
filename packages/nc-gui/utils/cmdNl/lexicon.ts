import { cmdEditDistance } from '../commandPaletteRelativeEdit'
import type { CmdNlLiteralGuard } from './extract'
import type { CmdNlField, CmdNlSchema } from './schema'
import { CONTRACTIONS, SHORTHAND } from './vocab/shorthand'
import { FIELD_ABBREVIATIONS, NOT_ABBREVIATIONS } from './vocab/abbreviations'
import { AGG_WORDS, SORT_SUPERLATIVES } from './vocab/aggregations'
import { CMP_PHRASES, NEGATIONS } from './vocab/comparators'
import { DATE_NOUNS, DATE_UNITS, MONTH_NAMES, WEEKDAY_NAMES } from './vocab/dates'
import { CONJUNCTIONS, GLUE_WORDS } from './vocab/fillers'
import { FIELD_SYNONYMS, ME_WORDS, OPTION_SYNONYMS } from './vocab/hints'
import { plural, singular, stem } from './vocab/inflect'
import { WORD_NUMBERS } from './vocab/numbers'

/**
 * What the words of a query can mean in this table: field titles, select options, members and
 * frequent text values (BRIDGE-style value anchors). Built once per schema, looked up per keystroke.
 */

export type CmdNlLexKind = 'field' | 'value' | 'member'

export interface CmdNlLexEntry {
  kind: CmdNlLexKind
  fieldId: string
  /** Option title or text value (value), member id (member). */
  value?: string
  words: string[]
  /** How strongly these words name the thing: 1 the full title, lower for partial titles. */
  quality: number
}

export interface CmdNlLexMatch {
  entry: CmdNlLexEntry
  /** Token range [start, end). */
  start: number
  end: number
  score: number
  via: 'exact' | 'inflection' | 'stem' | 'fuzzy' | 'abbrev'
}

interface TrieNode {
  children: Map<string, TrieNode>
  entries: CmdNlLexEntry[]
  /** On the path of some field title: only these words may be abbreviated. */
  field?: boolean
  /** Memoised transitions per typed word (see stepsFrom). */
  steps?: Map<string, TrieStep[]>
}

interface TrieStep {
  child: TrieNode
  score: number
  via: CmdNlLexMatch['via']
}

export interface CmdNlLexicon {
  schema: CmdNlSchema
  root: TrieNode
  /** Singular and plural forms of the table's name, plus generic record nouns. */
  tableNouns: Set<string>
  /** Values shorthand would rewrite ("11-50", "500+", "q3") → the fields that hold them. */
  literals: Map<string, Set<string>>
}

const node = (): TrieNode => ({ children: new Map(), entries: [] })

/** Lowercase, accents folded, outer punctuation dropped; inner "-", ".", "@", "'" kept. */
export function normCmdNlWord(word: string) {
  return word
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{N}%]+$/gu, '')
}

export function cmdNlWords(text: string) {
  return text
    .split(/[\s_/]+/)
    .map(normCmdNlWord)
    .filter(Boolean)
}

function insert(root: TrieNode, entry: CmdNlLexEntry) {
  let at = root
  for (const word of entry.words) {
    let next = at.children.get(word)
    if (!next) at.children.set(word, (next = node()))
    at = next
    if (entry.kind === 'field') at.field = true
  }
  if (!at.entries.some((e) => e.kind === entry.kind && e.fieldId === entry.fieldId && e.value === entry.value)) {
    at.entries.push(entry)
  }
}

const GENERIC_NOUNS = ['record', 'records', 'row', 'rows', 'item', 'items', 'entry', 'entries', 'one', 'ones']

/** What people call the hidden audit fields, by their UIDT. */
const SYSTEM_SYNONYMS: Record<string, string[]> = {
  CreatedTime: [
    'created',
    'created at',
    'created on',
    'created date',
    'date created',
    'creation',
    'creation date',
    'added',
    'added on',
    'date added',
  ],
  LastModifiedTime: [
    'last modified',
    'modified',
    'modified at',
    'updated',
    'updated at',
    'last updated',
    'changed',
    'last changed',
    'edited',
    'last edited',
    'last activity',
    'touched',
    'last touched',
  ],
  CreatedBy: ['created by', 'added by', 'creator'],
  LastModifiedBy: ['modified by', 'updated by', 'edited by', 'changed by', 'last edited by', 'last updated by'],
}

/** Whether a user field already owns these exact words (system fields never override it). */
function hasUserField(root: TrieNode, words: string[], schema: CmdNlSchema) {
  let at: TrieNode | undefined = root
  for (const w of words) at = at?.children.get(w)
  return !!at?.entries.some((e) => e.kind === 'field' && !schema.fields.find((f) => f.id === e.fieldId)?.system)
}

/** Synonyms never claim these: they're glue, aggregations or comparators elsewhere. */
const RESERVED = new Set([...GLUE_WORDS, ...AGG_WORDS.flatMap(([p]) => p), 'on', 'live', 'level', 'who', 'called', 'named'])

/** Text fields whose loaded values repeat enough to be names ("Austin"), not free text. */
function valueAnchors(field: CmdNlField, rows: Record<string, unknown>[]) {
  if (field.kind !== 'text' || field.pv || !rows.length) return []
  const seen = new Map<string, string>()
  for (const row of rows) {
    const v = row[field.title]
    if (typeof v !== 'string' || !v.trim() || v.length > 40) continue
    const key = v.trim().toLowerCase()
    if (!seen.has(key)) seen.set(key, v.trim())
  }
  // Mostly-unique columns (titles, notes) aren't value vocabularies.
  if (seen.size > Math.max(8, rows.length * 0.5) || seen.size > 60) return []
  return [...seen.values()]
}

/** "New York" → "ny", "Cold call" → "cc": the initials of a multi-word value, scored below its name. */
function insertInitials(root: TrieNode, words: string[], entry: Omit<CmdNlLexEntry, 'words' | 'quality'>) {
  if (words.length < 2) return
  const initials = words.map((w) => w[0]).join('')
  if (/^[a-z]{2,}$/.test(initials) && !RESERVED.has(initials) && !NOT_ABBREVIATIONS.has(initials)) {
    insert(root, { ...entry, words: [initials], quality: 0.75 })
  }
}

/** One word that shorthand would rewrite: ranges, "+", "%", "/", period codes, chat spellings. */
function isRewritable(key: string) {
  if (!/^\S+$/.test(key)) return false
  return /[-–—+/%]|\.\./.test(key) || /^(q[1-4]|ytd|n\/a)$/.test(key) || key in SHORTHAND || key in CONTRACTIONS
}

/** Words between a field and its value: "size is 11-50", "size = 500+", "in 1-10". */
const LITERAL_LEAD = new Set([
  'is',
  'are',
  'was',
  'were',
  'be',
  '=',
  '==',
  'in',
  'of',
  'with',
  'not',
  'isnt',
  "isn't",
  'equals',
  'equal',
  'to',
  ',',
  'a',
  'an',
  'the',
  'at',
])

/**
 * Keeps an option or anchored value verbatim ("11-50", "500+") instead of letting shorthand read
 * it as a range or "or more": when the field just before it holds that value, or no field does.
 * A different field before it ("annual revenue 11-50") leaves the range reading alone.
 */
export function cmdNlLiteralGuard(lex: CmdNlLexicon, onUnanchored?: () => void): CmdNlLiteralGuard | undefined {
  if (!lex.literals.size) return
  return (tokens, i) => {
    const owners = lex.literals.get(tokens[i]!.text.toLowerCase())
    if (!owners) return false
    let j = i - 1
    while (j >= 0 && LITERAL_LEAD.has(tokens[j]!.word)) j--
    const words = tokens.map((t) => t.word)
    const fields = new Set<string>()
    for (let k = Math.max(0, j - 3); k <= j; k++) {
      for (const m of cmdNlLexAt(lex, words, k, ['field'])) if (m.end === j + 1) fields.add(m.entry.fieldId)
    }
    // No field names it ("companies are 500+"): the option leads, the range stays an alternative.
    if (!fields.size) onUnanchored?.()
    return !fields.size || [...fields].some((id) => owners.has(id))
  }
}

const cache = new WeakMap<CmdNlSchema, { rows?: unknown; lexicon: CmdNlLexicon }>()

export function buildCmdNlLexicon(schema: CmdNlSchema, rows?: Record<string, unknown>[]): CmdNlLexicon {
  const hit = cache.get(schema)
  if (hit && hit.rows === rows) return hit.lexicon

  const root = node()
  const optionTitles = new Set(schema.fields.flatMap((f) => (f.options ?? []).map((o) => o.toLowerCase())))
  const titleWordCount = new Map<string, number>()
  const userFields = schema.fields.filter((f) => !f.system)
  for (const field of userFields)
    for (const w of new Set(cmdNlWords(field.title))) titleWordCount.set(w, (titleWordCount.get(w) ?? 0) + 1)

  const tableWords = cmdNlWords(schema.table.title)
  const last = tableWords[tableWords.length - 1]
  const tableNouns = new Set(GENERIC_NOUNS)
  if (last) for (const w of [last, singular(last), plural(singular(last))]) tableNouns.add(w)

  const literals = new Map<string, Set<string>>()
  const addLiteral = (value: string, fieldId: string) => {
    const key = value.trim().toLowerCase()
    if (!isRewritable(key)) return
    if (!literals.has(key)) literals.set(key, new Set())
    literals.get(key)!.add(fieldId)
  }

  for (const field of userFields) {
    const words = cmdNlWords(field.title)
    if (!words.length) continue
    insert(root, { kind: 'field', fieldId: field.id, words, quality: 1 })
    // "close date" → "close": the title without a trailing date noun.
    if (words.length > 1 && DATE_NOUNS.has(words[words.length - 1]!)) {
      insert(root, { kind: 'field', fieldId: field.id, words: words.slice(0, -1), quality: 0.9 })
    }
    // A distinctive word of a longer title ("referral" for "Referral source").
    // The table's own noun ("company" in "Company Size") counts records; it never names the field alone.
    if (words.length > 1) {
      for (const w of words) {
        if (w.length >= 4 && !GLUE_WORDS.has(w) && !DATE_NOUNS.has(w) && !tableNouns.has(w) && titleWordCount.get(w) === 1) {
          insert(root, { kind: 'field', fieldId: field.id, words: [w], quality: 0.7 })
          for (const abbr of FIELD_ABBREVIATIONS[w] ?? []) {
            if (!RESERVED.has(abbr) && !titleWordCount.has(abbr))
              insert(root, { kind: 'field', fieldId: field.id, words: [abbr], quality: 0.65 })
          }
        }
      }
    }
    // Irregular abbreviations of a title word ("number" → "num"): the title with that word swapped.
    words.forEach((w, k) => {
      for (const abbr of FIELD_ABBREVIATIONS[w] ?? []) {
        if (RESERVED.has(abbr) || titleWordCount.has(abbr)) continue
        insert(root, { kind: 'field', fieldId: field.id, words: words.map((x, j) => (j === k ? abbr : x)), quality: 0.9 })
      }
    })
    // Initials of a long title ("date of birth" → "dob").
    if (words.length >= 3) {
      const initials = words.map((w) => w[0]).join('')
      if (/^[a-z]{3,}$/.test(initials) && !RESERVED.has(initials)) {
        insert(root, { kind: 'field', fieldId: field.id, words: [initials], quality: 0.85 })
      }
    }
    // Everyday names ("units" → Qty), unless another field is called that or it's a reserved word.
    // A multi-word name may hold a reserved word ("deal value") as long as one word isn't.
    for (const w of words) {
      for (const syn of FIELD_SYNONYMS[w] ?? FIELD_SYNONYMS[singular(w)] ?? []) {
        const sw = cmdNlWords(syn)
        if (!sw.length || (sw.length === 1 ? RESERVED.has(sw[0]!) : sw.every((x) => RESERVED.has(x)))) continue
        if (sw.every((x) => titleWordCount.has(x))) continue
        insert(root, { kind: 'field', fieldId: field.id, words: sw, quality: 0.8 })
      }
    }
    for (const option of field.options ?? []) {
      const ow = cmdNlWords(option)
      if (!ow.length) continue
      insert(root, { kind: 'value', fieldId: field.id, value: option, words: ow, quality: 1 })
      addLiteral(option, field.id)
      // Everyday names for the option ("stuck" → Blocked), unless they name another option or a field.
      for (const syn of OPTION_SYNONYMS[option.toLowerCase()] ?? []) {
        const sw = cmdNlWords(syn)
        if (!sw.length || optionTitles.has(syn) || (sw.length === 1 && (RESERVED.has(sw[0]!) || titleWordCount.has(sw[0]!))))
          continue
        insert(root, { kind: 'value', fieldId: field.id, value: option, words: sw, quality: 0.85 })
      }
      insertInitials(root, ow, { kind: 'value', fieldId: field.id, value: option })
    }
    for (const member of field.members ?? []) {
      const name = cmdNlWords(member.name)
      if (name.length) insert(root, { kind: 'member', fieldId: field.id, value: member.id, words: name, quality: 1 })
      if (name.length > 1) {
        insert(root, { kind: 'member', fieldId: field.id, value: member.id, words: [name[0]!], quality: 0.95 })
        insert(root, { kind: 'member', fieldId: field.id, value: member.id, words: [name[name.length - 1]!], quality: 0.85 })
      }
      if (member.email) {
        insert(root, { kind: 'member', fieldId: field.id, value: member.id, words: [member.email.toLowerCase()], quality: 1 })
        const local = member.email.split('@')[0]!.toLowerCase()
        insert(root, { kind: 'member', fieldId: field.id, value: member.id, words: [local], quality: 0.9 })
        const parts = local.split(/[._-]+/).filter((p) => p.length >= 3)
        if (parts.length > 1) insert(root, { kind: 'member', fieldId: field.id, value: member.id, words: parts, quality: 0.85 })
      }
    }
    for (const value of valueAnchors(field, rows ?? [])) {
      const vw = cmdNlWords(value)
      if (!vw.length) continue
      insert(root, { kind: 'value', fieldId: field.id, value, words: vw, quality: 0.95 })
      insertInitials(root, vw, { kind: 'value', fieldId: field.id, value })
      addLiteral(value, field.id)
    }
  }

  // Hidden audit fields last, by title and everyday names, only where no user field took the words.
  for (const field of schema.fields.filter((f) => f.system)) {
    const phrases = [field.title.toLowerCase(), ...(SYSTEM_SYNONYMS[field.uidt ?? ''] ?? [])]
    phrases.forEach((phrase, k) => {
      const words = cmdNlWords(phrase)
      if (!words.length || hasUserField(root, words, schema)) return
      insert(root, { kind: 'field', fieldId: field.id, words, quality: k === 0 ? 0.95 : 0.85 })
    })
    // Low, so "ann's deals" still means the user's own people field; "created by ann" names this one.
    for (const member of field.members ?? []) {
      const name = cmdNlWords(member.name)
      const local = member.email?.split('@')[0]?.toLowerCase()
      for (const words of [name, name.slice(0, 1), local ? [local] : []]) {
        if (words.length) insert(root, { kind: 'member', fieldId: field.id, value: member.id, words, quality: 0.6 })
      }
    }
  }

  const lexicon = { schema, root, tableNouns, literals }
  cache.set(schema, { rows, lexicon })
  return lexicon
}

const NEGATION_PREFIXES = ['non-', 'non', 'un', 'in', 'im', 'ir', 'il', 'dis']

/** "inactive" vs "active": one word is the other negated, so they must never match as a typo or stem. */
function negationOf(a: string, b: string) {
  return NEGATION_PREFIXES.some((p) => a === p + b || b === p + a)
}

/** Function words never read as an abbreviation of a field title. */
const NOT_ABBREV = new Set([
  ...NOT_ABBREVIATIONS,
  ...GLUE_WORDS,
  ...AGG_WORDS.flatMap(([p]) => p),
  ...CMP_PHRASES.flatMap(([p]) => p),
  ...NEGATIONS,
  ...Object.keys(CONJUNCTIONS),
  ...Object.keys(DATE_UNITS),
  ...Object.keys(WEEKDAY_NAMES),
  ...Object.keys(MONTH_NAMES),
  ...Object.keys(WORD_NUMBERS),
  ...Object.keys(SORT_SUPERLATIVES),
  ...ME_WORDS,
])

/**
 * "amt" for "amount", "est" for "estimate", "mgr" for "manager": the typed word is the title word's
 * start or a subsequence of its letters keeping the first. Scored below a typo of the full word.
 */
export function cmdNlAbbrevMatch(typed: string, word: string): number | undefined {
  if (!/^[a-z]{3,6}$/.test(typed) || NOT_ABBREV.has(typed)) return
  if (word.length < typed.length + 2 || typed[0] !== word[0]) return
  if (word.startsWith(typed)) return 0.8
  let k = 0
  for (const ch of word) if (ch === typed[k]) k++
  return k === typed.length ? 0.7 : undefined
}

/** How a typed word meets a lexicon word: exact 1, inflection .95, stem .85, typo .75, else 0. */
export function cmdNlWordMatch(typed: string, word: string): { score: number; via: CmdNlLexMatch['via'] } | undefined {
  if (typed === word) return { score: 1, via: 'exact' }
  if (negationOf(typed, word)) return
  if (singular(typed) === singular(word)) return { score: 0.95, via: 'inflection' }
  if (typed.length >= 4 && word.length >= 4) {
    const a = stem(typed)
    const b = stem(word)
    if (a.length >= 3 && a === b) return { score: 0.85, via: 'stem' }
  }
  if (typed.length >= 5 && /^[a-z]+$/.test(typed)) {
    // "assigned" isn't a typo of "signed": a word plus a prefix or suffix is a different word.
    if (Math.abs(typed.length - word.length) >= 2 && (typed.includes(word) || word.includes(typed))) return
    const allowed = typed.length >= 8 ? 2 : 1
    if (Math.abs(typed.length - word.length) <= allowed && cmdEditDistance(typed, word) <= allowed) {
      return { score: 0.75, via: 'fuzzy' }
    }
  }
}

/**
 * Every lexicon entry whose words start at token `i`, longest first then best scored. Each step
 * takes the exact child when there is one, otherwise the closest inflected/stemmed/typo'd child.
 */
export function cmdNlLexAt(lex: CmdNlLexicon, words: string[], i: number, kinds?: CmdNlLexKind[]): CmdNlLexMatch[] {
  const out: CmdNlLexMatch[] = []
  const walk = (at: TrieNode, j: number, score: number, via: CmdNlLexMatch['via']) => {
    if (j > i) {
      for (const entry of at.entries) {
        if (kinds && !kinds.includes(entry.kind)) continue
        out.push({ entry, start: i, end: j, score: score * entry.quality, via })
      }
    }
    const typed = words[j]
    if (typed === undefined) return
    for (const step of stepsFrom(lex, at, typed)) {
      walk(step.child, j + 1, score * step.score, step.via === 'exact' ? via : step.via)
    }
  }
  walk(lex.root, i, 1, 'exact')
  return out.sort((a, b) => b.end - a.end || b.score - a.score)
}

/**
 * Where a typed word leads from a trie node: the exact child, else the closest inflected/stemmed/
 * typo'd child, else every field word it abbreviates. Memoised on the node, so each typed word's
 * scan over the children runs once per lexicon rather than on every keystroke.
 */
function stepsFrom(lex: CmdNlLexicon, at: TrieNode, typed: string): TrieStep[] {
  at.steps ??= new Map()
  const hit = at.steps.get(typed)
  if (hit) return hit

  let steps: TrieStep[] = []
  const exact = at.children.get(typed)
  if (exact) steps = [{ child: exact, score: 1, via: 'exact' }]
  else {
    let best: TrieStep | undefined
    for (const [word, child] of at.children) {
      const m = cmdNlWordMatch(typed, word)
      if (m && (!best || m.score > best.score)) best = { child, score: m.score, via: m.via }
    }
    if (best) steps = [best]
    else if (!lex.tableNouns.has(typed)) {
      // Only field titles are abbreviated; every field word the abbreviation fits is a candidate.
      for (const [word, child] of at.children) {
        const s = child.field ? cmdNlAbbrevMatch(typed, word) : undefined
        if (s) steps.push({ child, score: s, via: 'abbrev' })
      }
    }
  }
  if (at.steps.size > 4000) at.steps.clear()
  at.steps.set(typed, steps)
  return steps
}
