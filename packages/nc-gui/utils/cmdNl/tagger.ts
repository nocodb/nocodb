/**
 * CPU inference for the Cmd+K token tagger trained in tools/cmdk-tagger. Mirrors cmdk_tagger/spec.py and
 * model.py exactly (tokenizer, hashing, schema features, forward pass); a parity test guards the contract.
 */

export interface CmdTaggerTensor {
  shape: number[]
  scale: number
  /** base64 int8 values, row-major. */
  q: string
}

export interface CmdTaggerModelDoc {
  version: number
  spec: {
    nBuckets: number
    maxIds: number
    features: string[]
    tags: string[]
    intents: string[]
    d: number
    h: number
  }
  tensors: Record<string, CmdTaggerTensor>
}

export interface CmdTaggerLexicon {
  fields: Set<string>
  options: Set<string>
  members: Set<string>
  tables: Set<string>
}

export interface CmdTaggerResult {
  tokens: string[]
  /** Per token, a probability per tag (order of spec.tags). */
  tagProbs: Float32Array[]
  tags: string[]
  intent: string
  intentProbs: Float32Array
}

const TOKEN_RE =
  /[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+|\d{4}-\d{2}-\d{2}|[$€£]?\d[\d,]*(?:\.\d+)?(?:bn|mo|k|m|b|d|w|h|y|%)?(?![\p{L}\p{N}_])|[\p{L}\p{N}][\p{L}\p{N}_'-]*|>=|<=|!=|==|[<>=+\-*/%^:]|,/gu
const NUM_RE = /^[$€£]?\d[\d,]*(?:\.\d+)?(?:bn|k|m|b|%)?$/
const DUR_TOKEN_RE = /^\d+(?:\.\d+)?(?:mo|d|w|h|y)$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = new Set(
  'jan january feb february mar march apr april may jun june jul july aug august sep sept september oct october nov november dec december'.split(
    ' ',
  ),
)
const WEEKDAYS = new Set(
  'mon monday tue tues tuesday wed wednesday thu thur thurs thursday fri friday sat saturday sun sunday today tomorrow yesterday'.split(
    ' ',
  ),
)
const OPERATORS = new Set(['>=', '<=', '!=', '==', '<', '>', '=', '+', '-', '*', '/', '%', '^', ':'])

export function cmdTaggerTokenize(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[0])
}

/** Character offsets of the tokens cmdTaggerTokenize returns, in the same order. */
export function cmdTaggerTokenOffsets(text: string): { start: number; end: number }[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }))
}

function fnv1a(s: string) {
  let h = 0x811c9dc5
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0
  return h
}

function hashIds(token: string, nBuckets: number, maxIds: number) {
  const low = token.toLowerCase()
  const padded = [...`^${low}$`]
  const keys = [`w:${low}`]
  for (const n of [2, 3]) for (let i = 0; i + n <= padded.length; i++) keys.push(`${n}:${padded.slice(i, i + n).join('')}`)
  return keys.slice(0, maxIds).map((k) => fnv1a(k) % nBuckets)
}

function wordsOf(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean)
}

function editDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i, ...new Array<number>(b.length).fill(0)]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]!
}

function fuzzyHit(token: string, words: Set<string>) {
  if (token.length >= 3) for (const w of words) if (w.startsWith(token)) return true
  if (token.length < 5) return false
  const allowed = token.length >= 8 ? 2 : 1
  for (const w of words) if (Math.abs(w.length - token.length) <= allowed && editDistance(token, w) <= allowed) return true
  return false
}

/** Word sets from the view's schema: field titles, select options, members (names and emails), table titles. */
export function buildCmdTaggerLexicon(input: { fields: string[]; options: string[]; members: string[]; tables: string[] }) {
  const lex: CmdTaggerLexicon = { fields: new Set(), options: new Set(), members: new Set(), tables: new Set() }
  for (const t of input.fields) wordsOf(t).forEach((w) => lex.fields.add(w))
  for (const t of input.options) wordsOf(t).forEach((w) => lex.options.add(w))
  for (const t of input.members) [...wordsOf(t.split('@')[0]!), ...wordsOf(t)].forEach((w) => lex.members.add(w))
  for (const t of input.tables) wordsOf(t).forEach((w) => lex.tables.add(w))
  return lex
}

export function cmdTaggerFeatures(tokens: string[], lex: CmdTaggerLexicon): number[][] {
  return tokens.map((tok, i) => {
    const low = tok.toLowerCase()
    const fieldExact = lex.fields.has(low)
    const optionExact = lex.options.has(low)
    const memberExact = lex.members.has(low)
    const first = tok.slice(0, 1)
    return [
      fieldExact,
      !fieldExact && fuzzyHit(low, lex.fields),
      optionExact,
      !optionExact && fuzzyHit(low, lex.options),
      memberExact,
      !memberExact && fuzzyHit(low, lex.members),
      lex.tables.has(low) || lex.tables.has(low.replace(/s+$/, '')),
      NUM_RE.test(low),
      DUR_TOKEN_RE.test(low),
      ISO_DATE_RE.test(low) || MONTHS.has(low) || WEEKDAYS.has(low),
      tok === ',',
      OPERATORS.has(tok),
      first !== first.toLowerCase() && first === first.toUpperCase(),
      i === 0,
    ].map(Number)
  })
}

function dequantize(t: CmdTaggerTensor) {
  const bytes = Uint8Array.from(atob(t.q), (c) => c.charCodeAt(0))
  const out = new Float32Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = ((bytes[i]! << 24) >> 24) * t.scale
  return out
}

function softmax(logits: Float32Array) {
  const max = Math.max(...logits)
  const exp = logits.map((v) => Math.exp(v - max))
  const sum = exp.reduce((a, b) => a + b, 0)
  return exp.map((v) => v / sum)
}

/** conv1d with "same" padding: x is [T][in], w is [out][in][k] row-major. */
function conv(x: Float32Array[], w: Float32Array, b: Float32Array, out: number, k: number, dilation: number) {
  const inC = x[0]?.length ?? 0
  const pad = ((k - 1) * dilation) / 2
  return x.map((_, t) => {
    const y = new Float32Array(out)
    for (let o = 0; o < out; o++) {
      let s = b[o]!
      for (let j = 0; j < k; j++) {
        const src = x[t + j * dilation - pad]
        if (!src) continue
        const base = o * inC * k + j
        for (let i = 0; i < inC; i++) s += w[base + i * k]! * src[i]!
      }
      y[o] = s > 0 ? s : 0
    }
    return y
  })
}

export function loadCmdTagger(doc: CmdTaggerModelDoc) {
  const { d, h, nBuckets, maxIds, tags, intents, features } = doc.spec
  const t = Object.fromEntries(Object.entries(doc.tensors).map(([name, tensor]) => [name, dequantize(tensor)]))
  const nFeat = features.length

  function tag(text: string, lex: CmdTaggerLexicon): CmdTaggerResult {
    const tokens = cmdTaggerTokenize(text)
    if (!tokens.length)
      return { tokens, tagProbs: [], tags: [], intent: intents[0]!, intentProbs: new Float32Array(intents.length) }
    const feats = cmdTaggerFeatures(tokens, lex)
    const x = tokens.map((tok, ti) => {
      const v = new Float32Array(d)
      const ids = hashIds(tok, nBuckets, maxIds)
      for (const id of ids) for (let j = 0; j < d; j++) v[j]! += t['emb.weight']![id * d + j]!
      for (let j = 0; j < d; j++) {
        let s = v[j]! / ids.length + t['feat.bias']![j]!
        for (let f = 0; f < nFeat; f++) s += t['feat.weight']![j * nFeat + f]! * feats[ti]![f]!
        v[j] = s
      }
      return v
    })
    const h1 = conv(x, t['conv1.weight']!, t['conv1.bias']!, h, 3, 1)
    const h2 = conv(h1, t['conv2.weight']!, t['conv2.bias']!, h, 3, 2).map((v, i) => v.map((a, j) => a + h1[i]![j]!))

    const tagProbs = h2.map((v) => {
      const logits = new Float32Array(tags.length)
      for (let c = 0; c < tags.length; c++) {
        let s = t['tag.bias']![c]!
        for (let j = 0; j < h; j++) s += t['tag.weight']![c * h + j]! * v[j]!
        logits[c] = s
      }
      return softmax(logits)
    })
    const pooled = new Float32Array(2 * h)
    for (let j = 0; j < h; j++) {
      let sum = 0
      let max = -Infinity
      for (const v of h2) {
        sum += v[j]!
        max = Math.max(max, v[j]!)
      }
      pooled[j] = sum / h2.length
      pooled[h + j] = max
    }
    const intentLogits = new Float32Array(intents.length)
    for (let c = 0; c < intents.length; c++) {
      let s = t['intent.bias']![c]!
      for (let j = 0; j < 2 * h; j++) s += t['intent.weight']![c * 2 * h + j]! * pooled[j]!
      intentLogits[c] = s
    }
    const intentProbs = softmax(intentLogits)
    const argmax = (p: Float32Array) => p.reduce((best, v, i) => (v > p[best]! ? i : best), 0)
    return { tokens, tagProbs, tags: tagProbs.map((p) => tags[argmax(p)]!), intent: intents[argmax(intentProbs)]!, intentProbs }
  }

  return { spec: doc.spec, tag }
}
