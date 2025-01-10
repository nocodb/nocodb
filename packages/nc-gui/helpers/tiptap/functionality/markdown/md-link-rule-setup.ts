import type MarkdownIt from 'markdown-it'

function mdLinkRuleSetupExt(md: MarkdownIt, { openLinkOnClick = false }: { openLinkOnClick?: boolean }) {
  if (!openLinkOnClick) {
    // Remove the href attribute from links
    md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
      const hrefIndex = tokens[idx]!.attrIndex('href')
      if (hrefIndex >= 0) {
        tokens[idx]!.attrs!.splice(hrefIndex, 1)
      }
      return self.renderToken(tokens, idx, options)
    }
  } else {
    // Add attributes to links
    md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
      const targetIndex = tokens[idx]!.attrIndex('target')
      if (targetIndex < 0) {
        tokens[idx]!.attrPush(['target', '_blank'])
      }
      const relIndex = tokens[idx]!.attrIndex('rel')
      if (relIndex < 0) {
        tokens[idx]!.attrPush(['rel', 'noopener noreferrer nofollow'])
      }
      const onClickIndex = tokens[idx]!.attrIndex('onmousedown')
      if (onClickIndex < 0) {
        tokens[idx]!.attrPush(['onmousedown', '(function(event) { event.stopImmediatePropagation(); })(event)'])
      }
      return self.renderToken(tokens, idx, options)
    }
  }
}

export { mdLinkRuleSetupExt }
