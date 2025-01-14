import * as Diff from 'diff'

/**
 * Perform a diff algorithm on the source string based on the target string. Reports the differences between the two strings as the diff blocks.
 *
 * - Handles two strings
 * - Tokenizes as words
 *
 * @param sourceString - Base text which changes will be relative to
 * @param targetString - the string which containes the changes
 * @returns array of diff blocks
 *
 * @example
 * ```typescript
 * // Single string or number search
 * diffTextBlocks("Hello World", "World"); // true
 * ```
 */
export const diffTextBlocks = (sourceString: string, targetString: string) => {
  return Diff.diffWords(sourceString, targetString).map((it) => ({
    text: it.value,
    op: it.added ? 'added' : it.removed ? 'removed' : 'unchanged',
  }))
}
