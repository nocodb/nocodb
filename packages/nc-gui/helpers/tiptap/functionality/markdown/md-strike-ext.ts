import type MarkdownIt from 'markdown-it'

function mdStrikeExt(md: MarkdownIt) {
  md.inline.ruler.before('emphasis', 'strikethrough', (state, silent) => {
    const max = state.posMax
    const start = state.pos

    if (state.src.charCodeAt(start) !== 0x7e /* ~ */) {
      return false
    }
    if (silent) {
      return false
    } // don't run any pairs in validation mode
    if (start + 2 >= max) {
      return false
    }

    state.pos = start + 1
    let found = false

    while (state.pos < max) {
      if (state.src.charCodeAt(state.pos) === 0x7e /* ~ */) {
        found = true
        break
      }

      state.md.inline.skipToken(state)
    }

    if (!found || start + 1 === state.pos) {
      state.pos = start
      return false
    }

    const content = state.src.slice(start + 1, state.pos)

    // don't allow unescaped spaces/newlines inside
    if (content.match(/(^|[^\\])(\\\\)*\s/)) {
      state.pos = start
      return false
    }

    // found!
    state.posMax = state.pos
    state.pos = start + 1

    // Earlier we checked !silent, but this implementation does not need it
    const token_so = state.push('ss_open', 's', 1)
    token_so.markup = '~'

    const token_t = state.push('text', '', 0)
    token_t.content = content.replace(/\\([ \\!"#$%&'()*+,./:;<=>?@[\]^_`{|}~-])/g, '$1')

    const token_sc = state.push('ss_close', 's', -1)
    token_sc.markup = '~'

    state.pos = state.posMax + 1
    state.posMax = max
    return true
  })

  // Rendering rules for opening and closing <s> tags
  md.renderer.rules.ss_open = function (_tokens, _idx) {
    return '<s>'
  }

  md.renderer.rules.ss_close = function (_tokens, _idx) {
    return '</s>'
  }
}

export { mdStrikeExt }
