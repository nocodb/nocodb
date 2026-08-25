import { readFileSync } from 'node:fs'
import type { SourceCodeTransformer } from 'unocss'

// Sass parses the argument of these as a selector list, so a nested `&` inside them resolves.
// Every other functional pseudo — `:deep()`, `:slotted()`, `:global()` — keeps its argument as
// opaque text, so the `&` reaches the browser verbatim in a selector that can never match.
// WindiCSS flattened SFC nesting before sass ran and substituted `&` textually, which is why the
// two call sites this caught rendered correctly until the UnoCSS migration removed that pass.
const SASS_SELECTOR_PSEUDOS = new Set([
  'not',
  'is',
  'matches',
  'where',
  'has',
  'any',
  'current',
  'host',
  'host-context',
  'nth-child',
  'nth-last-child',
])

// Blanks out comments and quoted strings so a `&` in prose or in a url() can't be read as part of
// a selector. Length is preserved to keep offsets pointing at the right line.
function maskLiterals(code: string) {
  let out = ''
  let i = 0

  while (i < code.length) {
    const char = code[i]
    const next = code[i + 1]
    let stop = -1

    if (char === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      stop = end === -1 ? code.length : end + 2
    } else if (char === '/' && next === '/' && code[i - 1] !== ':') {
      const end = code.indexOf('\n', i)
      stop = end === -1 ? code.length : end
    } else if (char === '"' || char === "'") {
      let j = i + 1
      while (j < code.length && code[j] !== char) j += code[j] === '\\' ? 2 : 1
      stop = Math.min(j + 1, code.length)
    }

    if (stop === -1) {
      out += char
      i++
    } else {
      out += code.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
    }
  }

  return out
}

function findUnresolvedAmpersands(code: string) {
  const masked = maskLiterals(code)
  const hits: { line: number; pseudo: string; selector: string }[] = []
  let start = 0

  for (let i = 0; i < masked.length; i++) {
    const char = masked[i]

    if (char !== '{' && char !== '}' && char !== ';') continue

    // `@at-root :deep(#{&} …)` is the one nested form that resolves: interpolation runs before the
    // selector is parsed, and @at-root drops the parent sass would otherwise prepend.
    if (char === '{' && !masked.slice(start, i).includes('@at-root')) {
      const pseudo = /::?([a-zA-Z-]+)\(/g
      pseudo.lastIndex = start

      let match = pseudo.exec(masked)
      while (match && match.index < i) {
        let depth = 1
        let end = pseudo.lastIndex
        while (end < i && depth > 0) {
          if (masked[end] === '(') depth++
          else if (masked[end] === ')') depth--
          end++
        }

        const name = match[1].toLowerCase()
        if (masked.slice(pseudo.lastIndex, end - 1).includes('&') && !SASS_SELECTOR_PSEUDOS.has(name)) {
          hits.push({
            line: code.slice(0, match.index).split('\n').length,
            pseudo: name,
            selector: code.slice(start, i).trim(),
          })
        }

        match = pseudo.exec(masked)
      }
    }

    start = i + 1
  }

  return hits
}

export const ncAmpersandGuard = (): SourceCodeTransformer => ({
  name: 'nc-ampersand-guard',
  enforce: 'pre',
  idFilter: (id) => /\.(scss|sass)($|\?)/.test(id),
  transform(code, id) {
    const hits = findUnresolvedAmpersands(code.original)
    if (!hits.length) return

    // Lines come out relative to the block, so an SFC needs its `<style>` offset added back.
    const file = id.split('?')[0]
    let blockOffset = 0
    try {
      const source = readFileSync(file, 'utf8')
      const at = source.indexOf(code.original)
      if (at > 0) blockOffset = source.slice(0, at).split('\n').length - 1
    } catch {
      // a virtual module, or the block was rewritten upstream — block-relative lines still help
    }

    const message = [
      `\`&\` inside :${hits[0].pseudo}() is not resolved by Sass — the compiled selector keeps a literal \`&\` and never matches.`,
      ...hits.map((hit) => `  ${file}:${blockOffset + hit.line}\n    ${hit.selector.split('\n').join('\n    ')}`),
      '  Move the `&` outside the parens (`& > :deep(.foo)`) or drop it (`:deep(> .foo)`).',
    ].join('\n')

    // Dev keeps rendering so one bad selector can't take the whole app down; the build refuses.
    if (process.env.NODE_ENV === 'production') throw new Error(message)

    console.warn(`[nc-ampersand-guard] ${message}`)
  },
})

export default ncAmpersandGuard
