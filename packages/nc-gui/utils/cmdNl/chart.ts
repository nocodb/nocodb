/**
 * A small weighted Earley parser over a token lattice: terminals are typed spans (one token or
 * several, overlapping alternatives allowed), skippable tokens (glue) may be passed over anywhere,
 * and every item keeps its K best derivations, so a parse yields the n-best values at the top.
 */

export interface ChartEdge {
  cat: string
  /** Token range [start, end). */
  start: number
  end: number
  value: unknown
  /** 0–1. */
  score: number
}

export interface ChartRule<E> {
  lhs: string
  rhs: string[]
  /** 0–1; multiplies the derivation's score. */
  weight: number
  /** The node's value from its children's; undefined rejects the derivation. Default: the only child, or all. */
  build?: (kids: unknown[], env: E) => unknown
}

/** A rule action may return this to scale its derivation's score (e.g. a guessed field). */
export class ChartScaled {
  constructor(readonly value: unknown, readonly factor: number) {}
}

export interface ChartGrammar<E> {
  rules: ChartRule<E>[]
  byLhs: Map<string, number[]>
}

export function compileChartGrammar<E>(rules: ChartRule<E>[]): ChartGrammar<E> {
  const byLhs = new Map<string, number[]>()
  rules.forEach((rule, i) => {
    if (!rule.rhs.length) throw new Error(`chart: empty rule for ${rule.lhs}`)
    byLhs.set(rule.lhs, [...(byLhs.get(rule.lhs) ?? []), i])
  })
  return { rules, byLhs }
}

/** A terminal a derivation used: its category, token range and value (for spans and chips). */
export interface ChartTerm {
  cat: string
  start: number
  end: number
  value: unknown
}

export interface ChartReading {
  value: unknown
  score: number
  /** Token range the reading spans; tokens outside it were all skippable. */
  start: number
  end: number
  /** Terminals the reading was built from, left to right. */
  terms: ChartTerm[]
}

export interface ChartOptions {
  /** Derivations kept per item and per constituent. */
  k?: number
  /** Tokens that may be passed over (glue words). */
  skippable?: (i: number) => boolean
  /** Score factor per skipped token, so a reading that uses a word beats one that skips it. */
  skipPenalty?: number
  /** Item budget; past it the parse stops and returns what it has. */
  maxItems?: number
}

export interface ChartResult {
  readings: ChartReading[]
  /** Terminal categories some item expects after the last token (prefix completion). */
  expected: Set<string>
}

interface Deriv {
  score: number
  kids: unknown[]
  terms: ChartTerm[]
}

interface Item {
  rule: number
  dot: number
  origin: number
  derivs: Deriv[]
}

interface ChartSet {
  items: Map<string, Item>
  /** Items by the symbol after their dot. */
  waiting: Map<string, Item[]>
  predicted: Set<string>
}

const keyCache = new WeakMap<object, string>()

/** A stable identity for derivation values, cached per object. */
function valueKey(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'
  const hit = keyCache.get(value)
  if (hit) return hit
  const key = JSON.stringify(value)
  keyCache.set(value, key)
  return key
}

/** Inserts `d` keeping the best `k` by score; same kids (by value) keep the better score. */
function insertDeriv(list: Deriv[], d: Deriv, k: number): boolean {
  const key = d.kids.map(valueKey).join('\u0001')
  const same = list.findIndex((x) => x.kids.length === d.kids.length && x.kids.map(valueKey).join('\u0001') === key)
  if (same >= 0) {
    if (list[same]!.score >= d.score) return false
    list.splice(same, 1)
  }
  if (list.length >= k && list[list.length - 1]!.score >= d.score) return false
  let at = list.findIndex((x) => x.score < d.score)
  if (at < 0) at = list.length
  list.splice(at, 0, d)
  if (list.length > k) list.length = k
  return true
}

export function parseChart<E>(
  grammar: ChartGrammar<E>,
  start: string,
  n: number,
  edges: ChartEdge[],
  env: E,
  opts: ChartOptions = {},
): ChartResult {
  const k = opts.k ?? 4
  const skippable = opts.skippable ?? (() => false)
  const skipPenalty = opts.skipPenalty ?? 0.999
  const maxItems = opts.maxItems ?? 20000
  const { rules } = grammar
  const isNonterminal = (sym: string) => grammar.byLhs.has(sym)

  const sets: ChartSet[] = Array.from({ length: n + 1 }, () => ({ items: new Map(), waiting: new Map(), predicted: new Set() }))
  const edgesAt: ChartEdge[][] = Array.from({ length: n + 1 }, () => [])
  for (const e of edges) if (e.start >= 0 && e.end <= n && e.end > e.start) edgesAt[e.start]!.push(e)

  /** Completed constituents: `${cat}|${origin}|${end}` → best values. */
  const done = new Map<string, Array<{ value: unknown; score: number; terms: ChartTerm[] }>>()
  let itemCount = 0
  let current = 0
  let queue: Array<{ item: Item; delta: Deriv[] }> = []

  const addItem = (j: number, rule: number, dot: number, origin: number, derivs: Deriv[]) => {
    const set = sets[j]!
    const key = `${rule}|${dot}|${origin}`
    let item = set.items.get(key)
    const fresh = !item
    if (!item) {
      if (++itemCount > maxItems) return
      item = { rule, dot, origin, derivs: [] }
      set.items.set(key, item)
      const next = rules[rule]!.rhs[dot]
      if (next) set.waiting.set(next, [...(set.waiting.get(next) ?? []), item])
    }
    const delta = derivs.filter((d) => insertDeriv(item!.derivs, d, k))
    // Later sets start their pass from all their items, so only this set's changes are queued.
    if (j === current && (fresh || delta.length)) queue.push({ item, delta: fresh ? item.derivs : delta })
  }

  const combine = (left: Deriv[], kid: unknown, score: number, terms: ChartTerm[]) =>
    left.map((d) => ({ score: d.score * score, kids: [...d.kids, kid], terms: d.terms.concat(terms) }))

  const complete = (j: number, item: Item, delta: Deriv[]) => {
    const rule = rules[item.rule]!
    for (const d of delta) {
      const built = rule.build ? rule.build(d.kids, env) : d.kids.length === 1 ? d.kids[0] : d.kids
      if (built === undefined) continue
      const value = built instanceof ChartScaled ? built.value : built
      if (value === undefined) continue
      const score = d.score * rule.weight * (built instanceof ChartScaled ? built.factor : 1)
      const ckey = `${rule.lhs}|${item.origin}|${j}`
      const list = done.get(ckey) ?? []
      const vk = valueKey(value)
      const same = list.findIndex((x) => valueKey(x.value) === vk)
      if (same >= 0 && list[same]!.score >= score) continue
      if (same >= 0) list.splice(same, 1)
      if (list.length >= k && list[list.length - 1]!.score >= score) continue
      list.push({ value, score, terms: d.terms })
      list.sort((a, b) => b.score - a.score)
      if (list.length > k) list.length = k
      done.set(ckey, list)
      for (const w of sets[item.origin]!.waiting.get(rule.lhs) ?? []) {
        addItem(j, w.rule, w.dot + 1, w.origin, combine(w.derivs, value, score, d.terms))
      }
    }
  }

  const predict = (j: number, sym: string) => {
    const set = sets[j]!
    if (set.predicted.has(sym)) return
    set.predicted.add(sym)
    for (const r of grammar.byLhs.get(sym) ?? []) addItem(j, r, 0, j, [{ score: 1, kids: [], terms: [] }])
  }

  let leadingSkippable = true
  for (let j = 0; j <= n; j++) {
    const set = sets[j]!
    current = j
    queue = [...set.items.values()].map((item) => ({ item, delta: item.derivs }))
    // A reading may start after leading glue, never after a word it would leave unexplained.
    if (leadingSkippable) predict(j, start)
    leadingSkippable &&= j < n && skippable(j)
    for (let q = 0; q < queue.length; q++) {
      const { item, delta } = queue[q]!
      const next = rules[item.rule]!.rhs[item.dot]
      if (next === undefined) complete(j, item, delta)
      else if (isNonterminal(next)) predict(j, next)
    }
    if (itemCount > maxItems || j === n) break

    for (const edge of edgesAt[j]!) {
      for (const item of set.waiting.get(edge.cat) ?? []) {
        const term: ChartTerm = { cat: edge.cat, start: edge.start, end: edge.end, value: edge.value }
        addItem(edge.end, item.rule, item.dot + 1, item.origin, combine(item.derivs, edge.value, edge.score, [term]))
      }
    }
    if (skippable(j)) {
      for (const item of set.items.values()) {
        if (item.dot === 0 || item.dot === rules[item.rule]!.rhs.length) continue
        addItem(
          j + 1,
          item.rule,
          item.dot,
          item.origin,
          item.derivs.map((d) => ({ score: d.score * skipPenalty, kids: d.kids, terms: d.terms })),
        )
      }
    }
  }

  // Readings: start-symbol constituents whose outside tokens can all be skipped.
  const readings: ChartReading[] = []
  const prefixSkippable = [true]
  for (let i = 0; i < n; i++) prefixSkippable.push(prefixSkippable[i]! && skippable(i))
  const suffixSkippable: boolean[] = Array(n + 1).fill(true)
  for (let i = n - 1; i >= 0; i--) suffixSkippable[i] = suffixSkippable[i + 1]! && skippable(i)
  for (const [ckey, list] of done) {
    const [cat, origin, end] = ckey.split('|')
    if (cat !== start) continue
    const s = Number(origin)
    const e = Number(end)
    if (!prefixSkippable[s] || !suffixSkippable[e]) continue
    for (const r of list) readings.push({ value: r.value, score: r.score, start: s, end: e, terms: r.terms })
  }
  readings.sort((a, b) => b.score - a.score || a.start - b.start)

  const expected = new Set<string>()
  for (const sym of sets[n]?.waiting.keys() ?? []) if (!isNonterminal(sym)) expected.add(sym)
  return { readings, expected }
}
