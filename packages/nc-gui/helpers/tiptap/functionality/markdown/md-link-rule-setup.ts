import type MarkdownIt from 'markdown-it'

function mdLinkRuleSetupExt(md: MarkdownIt, { openLinkOnClick = false }: { openLinkOnClick?: boolean }) {
  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const hrefIndex = tokens[idx]!.attrIndex('href')

    if (hrefIndex >= 0) {
      const hrefValue = tokens[idx]!.attrs![hrefIndex]![1]
      // Check if the href contains the special separator
      if (hrefValue.includes('~~~###~~~')) {
        // Split the href to extract tooltip content
        const [_, tooltipContent] = hrefValue.split('~~~###~~~')
        tokens[idx]!.tag = 'span' // Change the tag to `span`
        tokens[idx]!.attrs = [
          ['class', 'nc-rich-link-tooltip'], // Add the class
          ['data-tooltip', (tooltipContent || '').replace(/_/g, ' ')], // Add tooltip content
        ]

        return self.renderToken(tokens, idx, options)
      }
    }

    if (!openLinkOnClick) {
      // Remove the href attribute from links
      if (hrefIndex >= 0) {
        tokens[idx]!.attrs!.splice(hrefIndex, 1)
      }
    } else {
      // Add attributes to links
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
    }

    return self.renderToken(tokens, idx, options)
  }

  // Ensure that we don't render the closing tag for links with tooltips
  md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
    const previousToken = tokens[idx - 1]
    if (previousToken?.tag === 'span') {
      return '' // Skip closing tag for spans
    }
    return self.renderToken(tokens, idx, options)
  }
}

export { mdLinkRuleSetupExt }
