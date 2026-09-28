import type { SourceCodeTransformer } from 'unocss'
import windiOrder from './nc-windi-order.json'

// Rewrites `@apply a b;` to `--at-apply: "a b";` before sass runs.
//
// Sass reads the `!` in `@apply !bg-foo` as the start of a Sass flag (`!default`, `!important`)
// and aborts, so the ~5.5k directives inherited from WindiCSS have to be dealt with pre-sass.
// Doing that textually is the point: transformerDirectives' own `enforce: 'pre'` parses with
// css-tree, which cannot read SCSS, so it silently skips `@apply` behind `//` comments, after a
// nested rule block, or inside `@supports`. `--at-apply` is an ordinary custom property that
// passes through sass untouched, letting transformerDirectives expand it against valid CSS.
const APPLY_RE = /@apply\s+([^;{}]+?)\s*(?=;|})/g

// Splits on whitespace but keeps `hover:(a b)` and `w-[calc(100%_-_8px)]` in one piece.
function splitUtilities(body: string) {
  const out: string[] = []
  let current = ''
  let depth = 0

  for (const char of body) {
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth--

    if (/\s/.test(char) && depth === 0) {
      if (current) out.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current) out.push(current)

  return out
}

// A colon inside `[]` or `()` is part of a value (`bg-[url(a:b)]`), not a variant separator.
function lastVariantColon(utility: string) {
  let depth = 0
  let at = -1

  for (let i = 0; i < utility.length; i++) {
    const char = utility[i]
    if (char === '[' || char === '(') depth++
    else if (char === ']' || char === ')') depth--
    else if (char === ':' && depth === 0) at = i
  }

  return at
}

const isImportant = (utility: string) => utility.startsWith('!') || utility.includes(':!')
const bare = (utility: string) => utility.replace(/^!/, '').replace(/:!/g, ':')

function markImportant(utility: string): string {
  if (isImportant(utility)) return utility

  const group = /^([^\s([]*:)?\((.*)\)$/.exec(utility)
  if (group) return `${group[1] ?? ''}(${splitUtilities(group[2]).map(markImportant).join(' ')})`

  const colon = lastVariantColon(utility)

  return colon === -1 ? `!${utility}` : `${utility.slice(0, colon + 1)}!${utility.slice(colon + 1)}`
}

export const ncApplyTransformer = (): SourceCodeTransformer => ({
  name: 'nc-apply',
  enforce: 'pre',
  idFilter: (id) => /\.(scss|sass)($|\?)/.test(id),
  transform(code) {
    for (const match of code.original.matchAll(APPLY_RE)) {
      // WindiCSS let `@apply "!foo"` quote away this same sass conflict. The quotes are never
      // part of a utility, so drop them before re-quoting the body as a whole.
      // `@apply x y !important` is the directive-level form; WindiCSS parsed the flag off the
      // at-rule and marked every declaration it produced, whatever the ordering said.
      const directive = match[1].replace(/"/g, '')
      const forced = /\s!important\s*$/.test(directive)
      const utilities = splitUtilities(forced ? directive.replace(/\s!important\s*$/, '') : directive)

      if (forced) {
        code.overwrite(match.index, match.index + match[0].length, `--at-apply: "${utilities.map(markImportant).join(' ')}"`)
        continue
      }

      // WindiCSS merged the utilities of one @apply that share a selector into a single rule, and
      // `Style.add` copies the *host* style's important flag onto everything folded in after it.
      // The host is whichever utility its own ordering put first — so one `!` made the whole group
      // important, but only if it sat on that first utility. UnoCSS marks only what carries the
      // `!`, which is why blocks that used to beat an `!important` elsewhere stopped doing so.
      // nc-windi-order.json supplies the ranking needed to tell which utility was the host.
      const groups = new Map<string, string[]>()
      for (const utility of utilities) {
        const colon = lastVariantColon(utility)
        const variant = colon === -1 ? '' : utility.replace(/^!/, '').slice(0, colon)
        if (!groups.has(variant)) groups.set(variant, [])
        groups.get(variant)!.push(utility)
      }

      const spreading = new Set<string>()
      for (const members of groups.values()) {
        const ranked = members
          .map((member) => ({ member, rank: (windiOrder as Record<string, number>)[bare(member)] }))
          .filter((entry) => entry.rank !== undefined)
          .sort((a, b) => a.rank! - b.rank!)

        if (ranked.length && isImportant(ranked[0].member)) members.forEach((member) => spreading.add(member))
      }

      const body = utilities.map((utility) => (spreading.has(utility) ? markImportant(utility) : utility)).join(' ')

      code.overwrite(match.index, match.index + match[0].length, `--at-apply: "${body}"`)
    }
  },
})

export default ncApplyTransformer
