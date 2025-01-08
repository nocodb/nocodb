import MarkdownIt from 'markdown-it'

function mdStrikeExt(md: MarkdownIt) {
  // Extend the default Markdown-It strike-through parsing
  const originalStrike = md.renderer.rules.del_open
  const originalStrikeClose = md.renderer.rules.del_close

  md.inline.ruler.before('emphasis', 'custom_strike', (state, silent) => {
    const marker = state.src.charAt(state.pos)
    if (marker !== '~') {
      return false
    }

    const match = state.src.slice(state.pos).match(/^~{1,2}/)
    if (!match) {
      return false
    }

    const markerCount = match[0].length

    if (silent) {
      return true
    }

    if (markerCount === 2) {
      state.push('del_open', 's', 1)
    } else if (markerCount === 1) {
      state.push('strike_open', 's', 1)
    }

    const contentStart = state.pos + markerCount
    const contentEnd = state.src.indexOf(marker.repeat(markerCount), contentStart)

    if (contentEnd === -1) {
      return false
    }

    state.push('text', '', 0).content = state.src.slice(contentStart, contentEnd)

    if (markerCount === 2) {
      state.push('del_close', 's', -1)
    } else if (markerCount === 1) {
      state.push('strike_close', 's', -1)
    }

    state.pos = contentEnd + markerCount
    return true
  })

  md.renderer.rules.strike_open = (tokens, idx, options, env, self) => {
    return `<s>`
  }

  md.renderer.rules.strike_close = (tokens, idx, options, env, self) => {
    return `</s>`
  }

  // Retain default behavior for `~~` if necessary
  if (originalStrike) {
    md.renderer.rules.del_open = originalStrike
    md.renderer.rules.del_close = originalStrikeClose
  }
}

export { mdStrikeExt }
