/** Singular form of an English word, good enough for field titles and option names ("deals" → "deal"). */
export function singular(word: string): string {
  const w = word.toLowerCase()
  if (w.length <= 3 || w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return w
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`
  if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (w.endsWith('s')) return w.slice(0, -1)
  return w
}

export function plural(word: string): string {
  const w = word.toLowerCase()
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/.test(w)) return `${w}es`
  return `${w}s`
}

/**
 * A crude stem for matching a word against a field word: "closing"/"closed"/"close" → "clos",
 * "assigned"/"assignee" → "assign", "referred"/"referral" → "referr", "tagged"/"tags" → "tag".
 */
export function stem(word: string): string {
  let w = singular(word)
  for (const suffix of ['ing', 'ed', 'ee', 'er', 'al', 'e']) {
    if (w.length - suffix.length >= 3 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length)
      break
    }
  }
  // "tagg(ed)" / "referr(ed)": a doubled final consonant left by the suffix.
  return /([b-df-hj-np-tv-z])\1$/.test(w) && w.length >= 4 ? w.slice(0, -1) : w
}

/** "ann's" → "ann": the owner in a possessive, or undefined. */
export function possessive(word: string): string | undefined {
  const match = /^(.+?)(?:'s|’s|s')$/.exec(word)
  return match ? match[1] : undefined
}
