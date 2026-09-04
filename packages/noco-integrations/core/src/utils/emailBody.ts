import DOMPurify from 'isomorphic-dompurify';

/**
 * Allowlist of tags / attributes permitted in workflow email bodies.
 * The rich-text body input (TipTap) only emits this small formatting set —
 * anything else (scripts, styles, iframes, event handlers, non-http(s)/mailto
 * URIs) is stripped before the email is handed to a mail transport.
 */
export const EMAIL_HTML_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
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
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  FORBID_TAGS: [
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'link',
    'meta',
    'svg',
    'math',
    'base',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
};

/**
 * Heuristic to detect whether a stored email body is HTML (authored with the
 * rich-text input) rather than legacy plain text. The rich-text editor always
 * wraps content in block/inline formatting tags, whereas plain-text bodies
 * saved before rich-text support contain none — so existing configs keep
 * sending as plain text untouched.
 */
export function isLikelyHtml(value: string): boolean {
  if (!value) return false;
  return /<(?:p|br|strong|b|em|i|u|s|strike|a|span|ul|ol|li|blockquote|code|pre|h[1-6])\b[^>]*>/i.test(
    value,
  );
}

/**
 * Sanitize an HTML email body against {@link EMAIL_HTML_SANITIZE_CONFIG}.
 * Runs after variable interpolation, so record-driven content is scrubbed too.
 */
export function sanitizeEmailHtml(input: unknown): string {
  if (input == null) return '';
  return DOMPurify.sanitize(String(input), EMAIL_HTML_SANITIZE_CONFIG);
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/**
 * Derive a readable plain-text fallback from an HTML email body, used as the
 * `text` part of a multipart email for clients that don't render HTML.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<\/\s*(?:p|div|li|ul|ol|blockquote|h[1-6]|pre)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(
      /&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/gi,
      (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
    )
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export interface PreparedEmailBody {
  /** Whether the body should be sent as HTML */
  isHtml: boolean;
  /** Sanitized HTML content (only set when `isHtml` is true) */
  html?: string;
  /** Plain-text content — the body itself when plain, or a derived fallback when HTML */
  text: string;
}

/**
 * Normalize a workflow email body for sending. Rich-text (HTML) bodies are
 * sanitized and paired with a plain-text fallback; legacy plain-text bodies
 * pass through unchanged.
 */
export function prepareEmailBody(rawBody: unknown): PreparedEmailBody {
  const body =
    typeof rawBody === 'string'
      ? rawBody
      : rawBody == null
        ? ''
        : typeof rawBody === 'object'
          ? JSON.stringify(rawBody)
          : String(rawBody);

  if (!isLikelyHtml(body)) {
    return { isHtml: false, text: body };
  }

  const html = sanitizeEmailHtml(body);
  return { isHtml: true, html, text: htmlToPlainText(html) };
}
