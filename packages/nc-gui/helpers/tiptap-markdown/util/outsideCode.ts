// Opening code fence, also inside blockquotes and on a list item's marker line ("- ```").
// A backtick fence's info string has no backticks, so "```x``` text" is inline code.
const fenceOpenRegex = /^(?:\s|>|[-*+]\s|\d{1,9}[.)]\s)*(`{3,}(?=[^`]*$)|~{3,})/
// Inline code span: a backtick run closed by a run of the same length
const inlineCodeRegex = /(?<![`\\])(`+)(?!`).*?(?<!`)\1(?!`)/g
// Private-use character: stands in for an inline code span while the rewrites run
const CODE_MASK = ''
const codeMaskRegex = /(\d+)/g

function isClosingFence(line: string, fence: string) {
  const match = line.match(/^[\s>]*(`{3,}|~{3,})\s*$/)
  return !!match && match[1]![0] === fence[0] && match[1]!.length >= fence.length
}

/** Applies `rewrite` to each line outside fenced code blocks, with inline code spans masked. Code is literal. */
export function rewriteOutsideCode(markdownText: string, rewrite: (line: string) => string) {
  let fence: string | null = null

  return markdownText
    .split('\n')
    .map((line) => {
      if (fence) {
        if (isClosingFence(line, fence)) fence = null
        return line
      }

      const open = line.match(fenceOpenRegex)
      if (open) {
        fence = open[1]!
        return line
      }

      const spans: string[] = []
      const masked = line.replace(inlineCodeRegex, (span) => `${CODE_MASK}${spans.push(span) - 1}${CODE_MASK}`)

      return rewrite(masked).replace(codeMaskRegex, (_match, i) => spans[Number(i)]!)
    })
    .join('\n')
}
