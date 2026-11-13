/**
 * Whether `discarded` has a token that `reloaded` lacks, in order: true unless
 * `reloaded` is `discarded` with only insertions. Lets a stale collab editor
 * tell "our edits were lost" from "a peer saved more after us".
 *
 * Compares whole copies, not what we changed: a lost local deletion (or a
 * whitespace-only edit) is never reported, while a peer deleting text that
 * predates our edits is.
 */
export function tokensMissingFrom(discarded: string[], reloaded: string[]): boolean {
  let j = 0
  for (const token of discarded) {
    while (j < reloaded.length && reloaded[j] !== token) j++
    if (j === reloaded.length) return true
    j++
  }
  return false
}

/** {@link tokensMissingFrom} over whitespace-separated words. */
export function textMissingFrom(discarded: string, reloaded: string): boolean {
  const words = (text: string) => text.split(/\s+/).filter(Boolean)
  return tokensMissingFrom(words(discarded), words(reloaded))
}
