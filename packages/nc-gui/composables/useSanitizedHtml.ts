import DOMPurify from 'isomorphic-dompurify'

export interface SanitizeOptions {
  ALLOWED_TAGS?: string[]
  ALLOWED_ATTR?: string[]
  ALLOW_DATA_ATTR?: boolean
}

export const useSanitizedHtml = () => {
  const defaultConfig: SanitizeOptions = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'div', 'span',
      'input', // for markdown checkboxes
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'src', 'alt', 'title',
      'type', 'checked', 'disabled', // for markdown checkboxes
    ],
    ALLOW_DATA_ATTR: false,
  }

  const sanitize = (html: string, options?: SanitizeOptions): string => {
    if (!html) return ''
    const config = { ...defaultConfig, ...options }
    return DOMPurify.sanitize(html, config)
  }

  const sanitizeMarkdown = (html: string): string => {
    return sanitize(html, {
      ALLOWED_TAGS: [...defaultConfig.ALLOWED_TAGS!, 'input'],
    })
  }

  return { sanitize, sanitizeMarkdown }
}
