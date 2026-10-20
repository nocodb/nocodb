import DOMPurify from 'isomorphic-dompurify'
import { parseInertHtml } from '~/helpers/workflowExpressionHtml'
import { EMAIL_FILE_IMAGE_SCHEME } from '~/helpers/tiptap-markdown/extensions/emailImage'

// Mirrors of the send path's allowlists (EMAIL_HTML_SANITIZE_CONFIG / EMAIL_ALLOWED_CSS_PROPS in
// noco-integrations emailBody.ts): the preview shows only what the recipient receives. Keep in sync.
const PREVIEW_TAGS = [
  'p',
  'div',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'a',
  'span',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
]

const PREVIEW_ATTRS = ['href', 'src', 'style', 'align', 'alt', 'width', 'height', 'data-nc-file']

// `data:` images the send path inlines as Content-ID parts; SVG never. Stored run results drop
// their bytes, and an image without bytes is not shown.
const SENDABLE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]/i

const PREVIEW_CSS_PROPS = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'line-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-left',
  'border-left',
  'border-radius',
  'width',
  'height',
  'max-width',
  'vertical-align',
])

const SAFE_CSS_VALUE = /^[\w\s#,.%()'"-]+$/

function sanitizeStyle(style: string): string {
  return style
    .split(';')
    .map((decl) => {
      const idx = decl.indexOf(':')
      if (idx === -1) return ''
      const prop = decl.slice(0, idx).trim().toLowerCase()
      const value = decl.slice(idx + 1).trim()
      if (!PREVIEW_CSS_PROPS.has(prop) || !value || !SAFE_CSS_VALUE.test(value)) return ''
      if (/url\s*\(|expression\s*\(|\\/i.test(value)) return ''
      return `${prop}: ${value}`
    })
    .filter(Boolean)
    .join('; ')
}

/**
 * A run's rich-text value (untrusted: record data is interpolated in) made safe to render. Only
 * images the email carries survive: stored ones, with their `nc-file:` src moved to `data-nc-file`
 * for the caller to sign, and sendable `data:` ones. Nothing in the result loads a remote resource.
 */
export function sanitizeEmailPreviewHtml(html: string): string {
  const container = parseInertHtml(html)
  container.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? ''
    if (SENDABLE_DATA_IMAGE.test(src)) return
    if (!src.startsWith(EMAIL_FILE_IMAGE_SCHEME)) {
      img.remove()
      return
    }
    img.setAttribute('data-nc-file', src)
    img.removeAttribute('src')
  })

  const clean = parseInertHtml(
    DOMPurify.sanitize(container.innerHTML, {
      ALLOWED_TAGS: PREVIEW_TAGS,
      ALLOWED_ATTR: PREVIEW_ATTRS,
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
      // A custom URI regexp is applied to every non-URI-safe attribute; the image marker holds an
      // `nc-file:` value that must not be read as a link.
      ADD_URI_SAFE_ATTR: ['data-nc-file', 'align', 'width', 'height'],
    }),
  )
  // Only inline `data:` bytes may keep a src.
  clean.querySelectorAll('img[src]').forEach((img) => {
    if (!SENDABLE_DATA_IMAGE.test(img.getAttribute('src') ?? '')) img.remove()
  })
  clean.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const style = sanitizeStyle(el.getAttribute('style') ?? '')
    if (style) el.setAttribute('style', style)
    else el.removeAttribute('style')
  })
  return clean.innerHTML
}
