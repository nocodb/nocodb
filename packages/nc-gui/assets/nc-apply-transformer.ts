import type { SourceCodeTransformer } from 'unocss'

// Rewrites `@apply a b;` to `--at-apply: "a b";` before sass runs.
//
// Sass reads the `!` in `@apply !bg-foo` as the start of a Sass flag (`!default`, `!important`)
// and aborts, so the ~5.5k directives inherited from WindiCSS have to be dealt with pre-sass.
// Doing that textually is the point: transformerDirectives' own `enforce: 'pre'` parses with
// css-tree, which cannot read SCSS, so it silently skips `@apply` behind `//` comments, after a
// nested rule block, or inside `@supports`. `--at-apply` is an ordinary custom property that
// passes through sass untouched, letting transformerDirectives expand it against valid CSS.
const APPLY_RE = /@apply\s+([^;{}]+?)\s*(?=;|})/g

export const ncApplyTransformer = (): SourceCodeTransformer => ({
  name: 'nc-apply',
  enforce: 'pre',
  idFilter: (id) => /\.(scss|sass)($|\?)/.test(id),
  transform(code) {
    for (const match of code.original.matchAll(APPLY_RE)) {
      // WindiCSS let `@apply "!foo"` quote away this same sass conflict. The quotes are never
      // part of a utility, so drop them before re-quoting the body as a whole.
      const body = match[1].replace(/"/g, '').replace(/\s+/g, ' ')

      code.overwrite(match.index, match.index + match[0].length, `--at-apply: "${body}"`)
    }
  },
})

export default ncApplyTransformer
