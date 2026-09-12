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
    // `isLikelyHtml` treats a leading <div> as rich text, so div-structured bodies (API- or
    // import-authored; TipTap never emits them) must survive here too — otherwise the tags are
    // stripped and every line runs together in both parts.
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
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'align'],
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
  ADD_URI_SAFE_ATTR: ['target', 'rel', 'align'],
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
  const el = node as Element;
  const own = el.getAttribute('style');
  // Outlook's Word engine ignores text-align on blocks but honours the align attribute.
  const align = own && /text-align:\s*(center|right|justify)/i.exec(own)?.[1];
  if (align) el.setAttribute('align', align.toLowerCase());
  // The editor renders `li > p` inline, so a paragraph margin there would add gaps the
  // author never saw.
  const isListParagraph =
    data.tagName === 'p' && el.parentElement?.tagName?.toLowerCase() === 'li';
  const base = isListParagraph ? undefined : EMAIL_BASE_STYLES[data.tagName];
  if (!base) return;
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
  // The editor always serialises a block element first. Anchoring here (rather than "contains
  // any tag") means interpolated record text like `a<b and c>d` can never flip a plain-text
  // template into HTML mode.
  // The lookahead, not `\b`: a boundary also matches `<pre-approved offer>` or `<p.s. …>`, and
  // promoting that plain text to HTML deletes it — the sanitizer drops the unknown tag.
  return /^\s*<(?:p|h[1-6]|ul|ol|blockquote|pre|div)(?=[\s>/])/i.test(value);
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

const PLAIN_TEXT_BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'BLOCKQUOTE',
  'PRE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

/** One inline run: text, `<br>`, and links with the href a plain-text reader cannot click through to. */
function inlineToText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';

  const el = node as Element;

  if (el.tagName === 'BR') return '\n';

  if (el.tagName === 'A') {
    const label = childrenToText(el).trim();
    const url = (el.getAttribute('href') ?? '').replace(/^mailto:/i, '');
    if (!url) return label;
    if (!label) return url;
    return label === url || label.includes(url) ? label : `${label} (${url})`;
  }

  return childrenToText(el);
}

function childrenToText(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    out += inlineToText(child);
  });
  return out;
}

/**
 * Lines for one list, recursing into nested lists with a deeper indent. A single regex cannot
 * do this: a lazy `<ol>([\s\S]*?)<\/ol>` ends at the *first* nested `</ol>`, so inner items
 * get numbered as siblings and the outer list's remaining items fall through to bullets.
 */
function listToLines(list: Element): string[] {
  const ordered = list.tagName === 'OL';
  const lines: string[] = [];
  let index = 0;

  Array.from(list.children).forEach((child) => {
    // A sub-list authored as a *sibling* of the items (legacy WYSIWYG output) still belongs to
    // the item above it. Skipping it, as "only LI children" did, dropped its items entirely
    // while the HTML part kept them — the two MIME parts then disagreed.
    if (child.tagName === 'UL' || child.tagName === 'OL') {
      listToLines(child).forEach((line) => lines.push(line ? `  ${line}` : line));
      return;
    }

    if (child.tagName !== 'LI') return;

    const marker = ordered ? `${(index += 1)}. ` : '- ';
    const [first = '', ...rest] = blocksToLines(child);

    lines.push(`${marker}${first}`);
    // Continuations sit under the item's text; a nested list arrives already indented by its
    // own level, so each level adds exactly two spaces.
    rest.forEach((line) => lines.push(line ? `  ${line}` : line));
  });

  return lines;
}

function blocksToLines(parent: Node): string[] {
  const lines: string[] = [];
  let run = '';

  const flush = () => {
    if (!run) return;
    lines.push(...run.split('\n'));
    run = '';
  };

  parent.childNodes.forEach((child) => {
    if (child.nodeType === 1) {
      const el = child as Element;

      if (el.tagName === 'UL' || el.tagName === 'OL') {
        flush();
        lines.push(...listToLines(el));
        return;
      }

      if (PLAIN_TEXT_BLOCK_TAGS.has(el.tagName)) {
        flush();
        const inner = blocksToLines(el);
        // An empty block is a deliberate spacer; keep the blank line it authored.
        lines.push(...(inner.length ? inner : ['']));
        return;
      }
    }

    run += inlineToText(child);
  });

  flush();
  return lines;
}

/**
 * Derive a readable plain-text fallback from an HTML email body, used as the
 * `text` part of a multipart email for clients that don't render HTML.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  // Walk the markup rather than rewriting it: nesting is structural, and the DOM decodes
  // entities on the way. Callers pass already-sanitized HTML, so this parse is idempotent.
  const root = DOMPurify.sanitize(html, {
    ...EMAIL_HTML_SANITIZE_CONFIG,
    RETURN_DOM: true,
  }) as unknown as HTMLElement;

  return blocksToLines(root)
    .join('\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
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
/**
 * Upper bound on an HTML body handed to the sanitizer. DOMPurify parses synchronously on the
 * send path, and deeply nested markup a few hundred KB long can stall the event loop for tens
 * of seconds — no real email body comes close to this.
 */
export const MAX_EMAIL_HTML_BODY_LENGTH = 100_000;

export function prepareEmailBody(
  rawBody: unknown,
  opts: { isHtml: boolean },
): PreparedEmailBody {
  const body =
    typeof rawBody === 'string'
      ? rawBody
      : rawBody == null
        ? ''
        : typeof rawBody === 'object'
          ? JSON.stringify(rawBody)
          : String(rawBody);

  // The caller decides from the stored template, which is the same string the backend used to
  // decide whether to escape interpolated values. Sniffing the interpolated body here instead
  // let a record value flip an unescaped plain body into the HTML part.
  if (!opts.isHtml) {
    return { isHtml: false, text: body };
  }

  if (body.length > MAX_EMAIL_HTML_BODY_LENGTH) {
    throw new Error(
      `Email body exceeds the ${Math.floor(MAX_EMAIL_HTML_BODY_LENGTH / 1000)} KB limit for rich-text content`,
    );
  }

  const sanitized = sanitizeEmailHtml(body, { baseStyles: true });
  const html = `<div style="${EMAIL_BODY_STYLE}">${sanitized}</div>`;
  return { isHtml: true, html, text: htmlToPlainText(sanitized) };
}
