import { commandScore } from '~/components/cmd-k/command-score'
import type { CmdCommand, CmdContext, CmdLevel, CmdProvider } from '~/lib/types'

/** Runs per command id, for ranking frequent commands higher. */
export type CmdUsage = Record<string, { count: number; lastUsed: number }>

export const CMD_LEVELS: CmdLevel[] = ['record', 'field', 'selection', 'view', 'base', 'global']

/** Order within a level: the screen's main action first, then frequent ones, routine, utilities, destructive. */
export const CMD_PRIORITY = {
  primary: 100,
  high: 50,
  normal: 0,
  low: -50,
  danger: -100,
} as const

/** DOM id of a palette row, for `aria-activedescendant`; ids may hold any character. */
export function cmdRowDomId(id: string) {
  return `nc-cmdk-opt-${id.replace(/[^\w-]/g, (c) => `_${c.charCodeAt(0).toString(16)}`)}`
}

export function getCmdPriority(command: CmdCommand) {
  return command.priority ?? (command.danger ? CMD_PRIORITY.danger : CMD_PRIORITY.normal)
}

const CMD_USAGE_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000

/** Run count decayed by age (a run a week ago counts half); a submenu pick counts for its parent. */
export function getCmdFrecency(usage: CmdUsage | undefined, id: string, now = Date.now()) {
  const entry = usage?.[id.split('>')[0]!]
  if (!entry) return 0
  return entry.count * 0.5 ** (Math.max(0, now - entry.lastUsed) / CMD_USAGE_HALF_LIFE_MS)
}

/** At most +12%: settles near-ties, never lifts a clearly weaker text match. */
function cmdUsageBoost(usage: CmdUsage | undefined, id: string) {
  return Math.min(0.12, Math.log2(1 + getCmdFrecency(usage, id)) * 0.04)
}

export interface CmdContextLevel {
  level: CmdLevel
  context: CmdContext
}

export interface CmdSection {
  section: string
  commands: CmdCommand[]
}

/** Latest registration wins, so a record form opened on top of another owns the record level. */
function contextProviderOf(providers: CmdProvider[], level: CmdLevel) {
  return providers.findLast((p) => p.level === level && p.context)
}

/** Levels that currently have a chip, most specific first. */
export function getCmdContextLevels(providers: CmdProvider[]): CmdContextLevel[] {
  const levels: CmdContextLevel[] = []
  for (const level of CMD_LEVELS) {
    const context = contextProviderOf(providers, level)?.context
    if (context) levels.push({ level, context })
  }
  return levels
}

/**
 * Commands visible at `activeLevel`. Browsing shows the active level and the global one;
 * searching also reaches every level between them. More specific levels come first.
 */
export function getCmdScopedCommands(
  providers: CmdProvider[],
  activeLevel: CmdLevel,
  searching: boolean,
  usage?: CmdUsage,
): CmdCommand[] {
  const activeIndex = CMD_LEVELS.indexOf(activeLevel)
  const seen = new Set<string>()
  const commands: CmdCommand[] = []

  CMD_LEVELS.forEach((level, index) => {
    if (index < activeIndex) return
    if (!searching && index !== activeIndex && level !== 'global') return

    const contextProvider = contextProviderOf(providers, level)
    const levelCommands: CmdCommand[] = []

    for (const provider of providers) {
      if (provider.level !== level) continue
      // Covered-up contexts on the same level (an outer record form) stay hidden.
      if (provider.context && provider !== contextProvider) continue
      for (const command of provider.commands) {
        if (seen.has(command.id)) continue
        seen.add(command.id)
        levelCommands.push(command)
      }
    }

    // Stable, so equal priorities keep registration order.
    levelCommands.sort((a, b) => getCmdPriority(b) - getCmdPriority(a))

    // Within a section, used commands lead their priority band; each section keeps its slots.
    const sectionSlots = new Map<string, number[]>()
    levelCommands.forEach((command, index) => {
      const key = command.section ?? ''
      sectionSlots.set(key, [...(sectionSlots.get(key) ?? []), index])
    })
    const ordered = [...levelCommands]
    for (const slots of sectionSlots.values()) {
      const sectionCommands = slots
        .map((index) => levelCommands[index]!)
        .sort((a, b) => getCmdPriority(b) - getCmdPriority(a) || getCmdFrecency(usage, b.id) - getCmdFrecency(usage, a.id))
      slots.forEach((slot, i) => (ordered[slot] = sectionCommands[i]!))
    }

    commands.push(...ordered)
  })

  return commands
}

/** Words a query may carry without the command naming them ("go to deals", "open settings"). */
const CMD_FILLER_WORDS = new Set(['a', 'an', 'the', 'go', 'to', 'open', 'in', 'of', 'for', 'my'])

// Parent-title words a one-line query may leave out: "row height tall" addresses "Change row height…".
const CMD_PARENT_OPTIONAL_WORDS = new Set([
  ...CMD_FILLER_WORDS,
  'by',
  'with',
  'as',
  'on',
  'from',
  'into',
  'and',
  'or',
  'change',
  'set',
  'edit',
  'select',
  'choose',
  'switch',
  'update',
  'toggle',
  'pick',
])

/** How far a child row's own title (not its parent's) is addressed by the query; read by the ranker. */
const childOnlyMatch = new WeakMap<CmdCommand, boolean>()

/**
 * A command's expanded children and their title words, per command object: providers rebuild commands only
 * when their state changes, so this saves calling `children()` and normalising titles on every keystroke.
 */
const expandedChildren = new WeakMap<CmdCommand, { expanded: CmdCommand; words: string[] }[]>()

function expandedOf(command: CmdCommand, parentTitle: string) {
  const hit = expandedChildren.get(command)
  if (hit) return hit
  const list = command.children!()
    .filter((child) => !child.disabled)
    .map((child) => ({
      expanded: {
        ...child,
        id: `${command.id}>${child.id}`,
        title: `${parentTitle} › ${child.title}`,
        section: command.section,
        keywords: [...(child.keywords ?? []), ...(command.keywords ?? [])],
        priority: child.priority ?? command.priority,
        searchOnly: true,
      },
      words: normalizeCmdText(child.title).split(' '),
    }))
  expandedChildren.set(command, list)
  return list
}

/**
 * Lists submenu options as `Parent › Child`: always for `searchChildren`, and for other parents
 * only when the query names the parent and has words left for a child ("summarize score sum").
 */
function expandCmdChildren(commands: CmdCommand[], tokens: string[]): CmdCommand[] {
  return commands.flatMap((command) => {
    if (!command.children || command.lazyChildren) return [command]

    const parentTitle = command.title.replace(/…$/, '')
    const parentWords = normalizeCmdText(parentTitle).split(' ').filter(Boolean)

    // Each query word names at most one parent word, exact matches first, so "sum" in
    // "summarize score sum" is left for the child rather than read as "summarize".
    const free = new Set(parentWords)
    const claim = (match: (token: string, word: string) => boolean) => (token: string) => {
      const word = [...free].find((w) => match(token, w))
      if (word) free.delete(word)
      return !word
    }
    const leftover = tokens
      .filter(claim((token, word) => token === word))
      .filter(claim((token, word) => word.startsWith(token)))
      .filter((token) => !CMD_FILLER_WORDS.has(token))

    if (!command.searchChildren) {
      const required = parentWords.filter((word) => !CMD_PARENT_OPTIONAL_WORDS.has(word))
      if (!required.length || required.some((word) => free.has(word)) || !leftover.length) return [command]
    }

    return [
      command,
      ...expandedOf(command, parentTitle).map(({ expanded, words }) => {
        // A fresh object per query: the child-only match below is query-specific and keyed by it.
        const row = { ...expanded }
        childOnlyMatch.set(
          row,
          leftover.some((token) => matchCmdToken(token, words, words.join(' ')) > 0),
        )
        return row
      }),
    ]
  })
}

/** Normalised text and its words by raw string: providers rebuild command objects, but titles repeat. */
const normalizedCache = new Map<string, { text: string; words: string[]; chars?: Set<string> }>()

const NORMALIZED_CACHE_MAX = 20000

function normalizedOf(raw: string) {
  const hit = normalizedCache.get(raw)
  if (hit) return hit
  const text = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  if (normalizedCache.size >= NORMALIZED_CACHE_MAX) normalizedCache.clear()
  const entry = { text, words: text.split(' ') }
  normalizedCache.set(raw, entry)
  return entry
}

function normalizeCmdText(text: string) {
  return normalizedOf(text).text
}

// Openers of a question or request; none of them starts a command title.
const CMD_QUESTION_WORDS = new Set([
  'what',
  'how',
  'why',
  'who',
  'which',
  'when',
  'where',
  'can',
  'could',
  'should',
  'would',
  'is',
  'are',
  'does',
  'do',
  'did',
  'summarise',
  'summarize',
  'explain',
  'tell',
  'compare',
  'analyse',
  'analyze',
  'draft',
])

/**
 * Whether a query reads as a request for the AI rather than a command name: a question,
 * a question/request opener, or three or more words that match no command.
 */
export function isCmdNaturalLanguage(query: string, hasMatches: boolean, topTitle?: string) {
  const normalized = normalizeCmdText(query)
  const words = normalized.split(' ').filter(Boolean)
  if (!words.length) return false
  if (query.trim().endsWith('?')) return true
  // A command named by the query ("summarize score" → "Summarize Score…") beats a request word.
  const title = topTitle ? normalizeCmdText(topTitle.replace(/…$/, '')) : ''
  if (title && (title.startsWith(normalized) || normalized.startsWith(title))) return false
  if (words.length >= 2 && CMD_QUESTION_WORDS.has(words[0]!)) return true
  return !hasMatches && words.length >= 3
}

/** How well one query word matches one field: whole word > word start > inside a word. */
function matchCmdToken(token: string, words: string[], text: string) {
  if (words.includes(token)) return 1
  if (words.some((word) => word.startsWith(token))) return 0.85
  if (token.length >= 3 && text.includes(token)) return 0.5
  return 0
}

/** 0 when some meaningful query word matches nothing; otherwise the mean of per-word scores. */
/** Field weights: what the row says outranks its keywords, its hint and its section. */
const CMD_FIELD_WEIGHTS = [1, 0.75, 0.6, 0.5]

function scoreCmdCommand(command: CmdCommand, tokens: string[], normalizedQuery: string) {
  const title = normalizedOf(command.title).text
  const fields = [
    normalizedOf(command.title),
    normalizedOf(command.keywords?.join(' ') ?? ''),
    normalizedOf(command.hint ?? ''),
    normalizedOf(command.section ?? ''),
  ].map((field, i) => ({ ...field, weight: CMD_FIELD_WEIGHTS[i]! }))

  // A query of only filler words ("go to") must match them all, or every row with "to" qualifies.
  const fillersOptional = !tokens.every((token) => CMD_FILLER_WORDS.has(token))
  let total = 0
  let counted = 0
  for (const token of tokens) {
    const best = Math.max(...fields.map((field) => matchCmdToken(token, field.words, field.text) * field.weight))
    if (best === 0) {
      if (fillersOptional && CMD_FILLER_WORDS.has(token)) continue
      return 0
    }
    total += best
    counted++
  }
  if (!counted) return 0

  const exact = title === normalizedQuery ? 0.5 : title.startsWith(normalizedQuery) ? 0.25 : 0
  return total / counted + exact
}

/**
 * Empty query drops search-only commands. Otherwise every meaningful query word must match the
 * title, keywords, hint or section; fuzzy matching is only the fallback when nothing does.
 * The screen's own commands (`contextIds`), higher priorities and frequent use win near-ties.
 */
export function searchCmdCommands(
  commands: CmdCommand[],
  query: string,
  contextIds: Set<string> = new Set(),
  usage?: CmdUsage,
): CmdCommand[] {
  const normalizedQuery = normalizedOf(query).text
  if (!normalizedQuery) return commands.filter((command) => !command.searchOnly)

  const tokens = normalizedQuery.split(' ')
  const candidates = expandCmdChildren(commands, tokens)

  const rank = (scoreOf: (command: CmdCommand) => number) =>
    candidates
      .map((command, index) => {
        const textScore = scoreOf(command)
        const boost =
          // Above the usage boost's 0.12 cap, so the chip's own command wins a text tie.
          (contextIds.has(command.id.split('>')[0]!) ? 0.2 : 0) +
          getCmdPriority(command) / 2000 +
          cmdUsageBoost(usage, command.id) +
          // A query that also names the option ("set stage won") runs the option, not its menu.
          (childOnlyMatch.get(command) ? 0.15 : 0)
        return { command, index, textScore, score: textScore * (1 + boost) }
      })
      .filter(({ textScore }) => textScore > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ command }) => command)

  const strict = rank((command) => scoreCmdCommand(command, tokens, normalizedQuery))
  if (strict.length) return strict

  // Typos and abbreviations: keep only fuzzy matches close to the best one. commandScore is 0 unless every
  // query character occurs in the title (transpositions included), so that check skips most titles exactly.
  const queryChars = [...new Set(normalizedQuery)]
  const fuzzyScores = new Map<CmdCommand, number>()
  const fuzzyScore = (command: CmdCommand) => {
    const known = fuzzyScores.get(command)
    if (known !== undefined) return known
    const title = normalizedOf(command.title)
    title.chars ??= new Set(title.text)
    const score = queryChars.every((c) => title.chars!.has(c)) ? commandScore(title.text, normalizedQuery) : 0
    fuzzyScores.set(command, score)
    return score
  }
  const best = Math.max(0, ...candidates.map(fuzzyScore))
  return rank((command) => {
    const score = fuzzyScore(command)
    return score >= best * 0.5 ? score : 0
  })
}

/** Groups by section in order of first appearance; commands without one share an unnamed group. */
export function groupCmdCommands(commands: CmdCommand[]): CmdSection[] {
  const sections = new Map<string, CmdCommand[]>()
  for (const command of commands) {
    const section = command.section ?? ''
    if (!sections.has(section)) sections.set(section, [])
    sections.get(section)!.push(command)
  }
  return [...sections].map(([section, sectionCommands]) => ({ section, commands: sectionCommands }))
}
