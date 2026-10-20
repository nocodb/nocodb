/**
 * Parse without executing: editor / AI HTML is untrusted, and a detached div still fires
 * `<img onerror>` on innerHTML assignment. DOMParser documents are inert.
 */
export function parseInertHtml(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
}

const IMAGE_PLACEHOLDER_ATTR = 'data-nc-image'

/** Swap body images for numbered placeholders, so AI calls never carry (or rewrite) their sources. */
export function stashImages(html: string): { html: string; images: string[] } {
  const container = parseInertHtml(html)
  const images: string[] = []
  container.querySelectorAll('img').forEach((el) => {
    const placeholder = container.ownerDocument.createElement('img')
    placeholder.setAttribute(IMAGE_PLACEHOLDER_ATTR, String(images.length))
    images.push(el.outerHTML)
    el.replaceWith(placeholder)
  })
  return { html: container.innerHTML, images }
}

/** Put stashed images back. Any the model dropped are appended, so a rewrite never loses one. */
export function restoreImages(html: string, images: string[]): string {
  if (!images.length) return html
  const container = parseInertHtml(html)
  const placed = new Set<number>()
  container.querySelectorAll('img').forEach((el) => {
    const index = Number(el.getAttribute(IMAGE_PLACEHOLDER_ATTR) ?? NaN)
    const original = Number.isInteger(index) && !placed.has(index) ? images[index] : undefined
    const restored = original ? parseInertHtml(original).firstElementChild : null
    if (!restored) {
      el.remove()
      return
    }
    placed.add(index)
    el.replaceWith(restored)
  })
  const missing = images.filter((_, i) => !placed.has(i))
  return missing.length ? `${container.innerHTML}<p>${missing.join('')}</p>` : container.innerHTML
}

/** Turn expression chips produced by `editor.getHTML()` back into `{{ }}` tokens. */
export function expressionSpansToTokens(html: string): string {
  const container = parseInertHtml(html)
  container.querySelectorAll('span[data-type="workflowExpression"]').forEach((el) => {
    el.replaceWith(document.createTextNode(el.getAttribute('data-expression') || ''))
  })
  return container.innerHTML
}
