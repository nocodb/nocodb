/**
 * Parse without executing: editor / AI HTML is untrusted, and a detached div still fires
 * `<img onerror>` on innerHTML assignment. DOMParser documents are inert.
 */
export function parseInertHtml(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
}

/** Turn expression chips produced by `editor.getHTML()` back into `{{ }}` tokens. */
export function expressionSpansToTokens(html: string): string {
  const container = parseInertHtml(html)
  container.querySelectorAll('span[data-type="workflowExpression"]').forEach((el) => {
    el.replaceWith(document.createTextNode(el.getAttribute('data-expression') || ''))
  })
  return container.innerHTML
}
