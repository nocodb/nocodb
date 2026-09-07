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
  ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
  // Editor marks carry data-* mirrors of their styles; recipients never need them.
  ALLOW_DATA_ATTR: false,
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
  // A custom URI regexp is applied to every non-URI-safe attribute, which would eat target/rel.
  ADD_URI_SAFE_ATTR: ['target', 'rel'],
};

/**
 * Inline styles are the only styling mail clients honour, so `style` is allowed — but
 * only these declarations survive. Everything else (url(), position, behavior, …) is dropped.
 */
export const EMAIL_ALLOWED_CSS_PROPS = new Set([
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
]);

/**
 * Mail clients ignore <style> blocks and apply their own defaults (Times, browser heading
 * sizes…), so the editor's look is inlined per element at send time. Mirrors the editor CSS.
 */
export const EMAIL_BODY_STYLE =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f293a";

export const EMAIL_BASE_STYLES: Record<string, string> = {
  p: 'margin: 0 0 10px',
  h1: 'font-size: 20px; font-weight: 700; line-height: 1.3; margin: 16px 0 8px',
  h2: 'font-size: 18px; font-weight: 700; line-height: 1.3; margin: 14px 0 8px',
  h3: 'font-size: 16px; font-weight: 700; line-height: 1.3; margin: 12px 0 6px',
  blockquote: 'margin: 0 0 10px; padding-left: 12px; border-left: 2px solid #e7e7e9; color: #4a5268',
  ul: 'margin: 0 0 10px; padding-left: 20px',
  ol: 'margin: 0 0 10px; padding-left: 20px',
  li: 'margin: 2px 0',
  code: "font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; background-color: #f4f4f5; padding: 1px 4px; border-radius: 4px",
  a: 'color: #3366ff; text-decoration: underline',
};

const SAFE_CSS_VALUE = /^[\w\s#,.%()'"-]+$/;

export function sanitizeInlineStyle(style: string): string {
  return style
    .split(';')
    .map((decl) => {
      const idx = decl.indexOf(':');
      if (idx === -1) return '';
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (!EMAIL_ALLOWED_CSS_PROPS.has(prop)) return '';
      if (!value || !SAFE_CSS_VALUE.test(value)) return '';
      if (/url\s*\(|expression\s*\(|\\/i.test(value)) return '';
      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join('; ');
}

// DOMPurify hooks are global on the shared instance and the backend has other callers
// (comments, table names…), so both hooks only act while an email sanitize is running.
let emailSanitizeActive = false;
let applyBaseStyles = false;

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (!emailSanitizeActive || !applyBaseStyles) return;
  if (node.nodeType !== 1) return;
  const base = EMAIL_BASE_STYLES[data.tagName];
  if (!base) return;
  // No DOM lib in this package's tsconfig; the node is a jsdom Element at runtime.
  const el = node as unknown as {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
  };
  const own = el.getAttribute('style');
  // Base first so the author's own declarations win.
  el.setAttribute('style', own ? `${base}; ${own}` : base);
});

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (!emailSanitizeActive || data.attrName !== 'style') return;
  data.attrValue = sanitizeInlineStyle(data.attrValue);
  if (!data.attrValue) data.keepAttr = false;
});

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
export function sanitizeEmailHtml(
  input: unknown,
  options: { baseStyles?: boolean } = {},
): string {
  if (input == null) return '';
  emailSanitizeActive = true;
  applyBaseStyles = !!options.baseStyles;
  try {
    return DOMPurify.sanitize(String(input), EMAIL_HTML_SANITIZE_CONFIG);
  } finally {
    emailSanitizeActive = false;
    applyBaseStyles = false;
  }
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

  const sanitized = sanitizeEmailHtml(body, { baseStyles: true });
  const html = `<div style="${EMAIL_BODY_STYLE}">${sanitized}</div>`;
  return { isHtml: true, html, text: htmlToPlainText(sanitized) };
}
