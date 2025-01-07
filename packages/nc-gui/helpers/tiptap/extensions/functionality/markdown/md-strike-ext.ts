import type MarkdownIt from 'markdown-it'

function mdStrikeExt(md: MarkdownIt) {
  // Extend the default Markdown-It strike-through parsing
  const originalStrike = md.renderer.rules.del_open
  const originalStrikeClose = md.renderer.rules.del_close

  // Custom rule for handling ~ and ~~ strike-through with raw HTML
  md.inline.ruler.before('emphasis', 'custom_strike', (state, silent) => {
    const marker = state.src.charAt(state.pos)
    if (marker !== '~') {
      return false
    }

    const match = state.src.slice(state.pos).match(/^~{1,2}/) // Match ~ or ~~
    if (!match) {
      return false
    }

    const markerCount = match[0].length

    if (silent) {
      return true
    }

    // Handle opening tag based on single or double tilde
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

    // Handle raw HTML content inside strike-through
    let content = state.src.slice(contentStart, contentEnd)
    // Check if the content contains raw HTML tags and prevent escaping
    if (/<[^>]+>/g.test(content)) {
      state.push('text', '', 0).content = content // Leave HTML tags as is
    } else {
      state.push('text', '', 0).content = state.src.slice(contentStart, contentEnd)
    }

    // Handle closing tag based on single or double tilde
    if (markerCount === 2) {
      state.push('del_close', 's', -1)
    } else if (markerCount === 1) {
      state.push('strike_close', 's', -1)
    }

    state.pos = contentEnd + markerCount
    return true
  })

  // Modify the rendering to output <s> for both ~text~ and ~~text~~
  md.renderer.rules.strike_open = () => {
    return `<s>`
  }

  md.renderer.rules.strike_close = () => {
    return `</s>`
  }

  // Custom serialize function to handle raw HTML inside strike-through
  md.renderer.rules.text = (tokens, idx) => {
    const token = tokens[idx]
    // If the token contains HTML content (like <u> or other HTML tags), return it as raw HTML
    if (/<[^>]+>/g.test(token.content)) {
      return token.content // Preserve the raw HTML content
    } else {
      return md.utils.escapeHtml(token.content) // Escape non-HTML content
    }
  }

  // Retain default behavior for `~~` strike-through if necessary
  if (originalStrike) {
    md.renderer.rules.del_open = originalStrike
    md.renderer.rules.del_close = originalStrikeClose
  }
}

export { mdStrikeExt }
