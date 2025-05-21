import type MarkdownIt from 'markdown-it'

function mdImageAsText(md: MarkdownIt) {
  // Override the image rule
  md.renderer.rules.image = (tokens, idx) => {
    if (!tokens[idx]) return ''

    // Change the tag to `span`
    tokens[idx].tag = 'span' // Replace img with span

    // Get the src value from the attributes (it's the first attribute)
    const srcValue = tokens[idx].attrs?.[0]?.[1] // Safe access to src

    return `<a href="${srcValue}">${tokens[idx].content}</a>`
  }
}

export { mdImageAsText }
