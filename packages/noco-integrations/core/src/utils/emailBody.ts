import type DOMPurifyType from 'isomorphic-dompurify';

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
    // Only ever with a `cid:` src that names an image extracted from this body — see
    // extractInlineImages. Remote and data: sources are dropped.
    'img',
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'style',
    'align',
    'src',
    'alt',
    'width',
    'height',
  ],
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
  // `cid:` is narrowed to img src by the attribute hook.
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|cid):/i,
  // A custom URI regexp is applied to every non-URI-safe attribute, which would eat target/rel.
  ADD_URI_SAFE_ATTR: ['target', 'rel', 'align', 'width', 'height'],
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
  'width',
  'height',
  'max-width',
  'vertical-align',
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
let allowedInlineCids: ReadonlySet<string> = new Set();

let purify: typeof DOMPurifyType | undefined;

// isomorphic-dompurify loads jsdom (~13 MB heap), so it is required on first use, and the
// hooks are installed once, then.
function getPurify(): typeof DOMPurifyType {
  if (purify) return purify;
  purify = require('isomorphic-dompurify') as typeof DOMPurifyType;

  purify.addHook('uponSanitizeElement', (node, data) => {
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

  purify.addHook('uponSanitizeAttribute', (node, data) => {
    if (!emailSanitizeActive) return;
    if (data.attrName === 'href') {
      data.attrValue = normalizeEmailHref(data.attrValue);
      if (/^cid:/i.test(data.attrValue)) data.keepAttr = false;
      return;
    }
    if (data.attrName === 'src') {
      const cid = /^cid:(.+)$/i.exec(data.attrValue.trim())?.[1];
      if (
        node.nodeName !== 'IMG' ||
        !cid ||
        !allowedInlineCids.has(cid.toLowerCase())
      ) {
        data.keepAttr = false;
      }
      return;
    }
    if (data.attrName !== 'style') return;
    data.attrValue = sanitizeInlineStyle(data.attrValue);
    if (!data.attrValue) data.keepAttr = false;
  });

  // An image whose source was rejected would render as a broken-image box.
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (!emailSanitizeActive) return;
    if (node.nodeName === 'IMG' && !(node as Element).getAttribute('src')) {
      node.parentNode?.removeChild(node);
    }
  });

  return purify;
}

/**
 * A link URL that is a variable (`{{ record.Website }}`) only resolves here, and record values
 * often lack a scheme — without one the URI allowlist would strip the href. Runs before that check.
 */
export function normalizeEmailHref(raw: string): string {
  const value = (raw ?? '').trim();
  if (!value) return value;
  // Any scheme is left for the allowlist to judge; `example.com:8080` is a port, not a scheme.
  const isHostPort = /^(?:localhost|[^\s/:]+\.[^\s/:]+):\d+(?:[/?#]|$)/i.test(value);
  if (!isHostPort && /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(value)) return `mailto:${value}`;
  return `https://${value.replace(/^\/+/, '')}`;
}

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
  options: { baseStyles?: boolean; inlineCids?: Iterable<string> } = {},
): string {
  if (input == null) return '';
  emailSanitizeActive = true;
  applyBaseStyles = !!options.baseStyles;
  allowedInlineCids = new Set(
    [...(options.inlineCids ?? [])].map((cid) => cid.toLowerCase()),
  );
  try {
    return getPurify().sanitize(String(input), EMAIL_HTML_SANITIZE_CONFIG);
  } finally {
    emailSanitizeActive = false;
    applyBaseStyles = false;
    allowedInlineCids = new Set();
  }
}

/** An image embedded in the HTML part and referenced from it by Content-ID. */
export interface EmailInlineImage {
  cid: string;
  filename: string;
  contentType: string;
  content: Buffer;
}

/** Inline images as nodemailer attachments (SMTP and the core mailer). */
export function toNodemailerInlineAttachments(images: EmailInlineImage[]) {
  return images.map((image) => ({
    filename: image.filename,
    content: image.content,
    contentType: image.contentType,
    cid: image.cid,
    contentDisposition: 'inline' as const,
  }));
}

export const MAX_EMAIL_INLINE_IMAGES = 10;

/** Decoded bytes across all inline images; Outlook (Graph) rejects inline parts past ~3 MB. */
export const MAX_EMAIL_INLINE_IMAGES_SIZE = 2 * 1024 * 1024;

// SVG is excluded: it is a script-capable document, not a picture.
const INLINE_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

// Every run before the quote is bounded — the attributes ahead of `src` and the whitespace around
// `=`. Unbounded, a hostile body (many `<img`, or a huge whitespace run after `src=`) backtracks
// quadratically, and the reference scan runs on every workflow save, inside the API process.
const DATA_IMAGE_SRC =
  /(<img\b[^>]{0,512}?\bsrc\s{0,16}=\s{0,16})(["'])data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]*)\2/gi;

// The payload of an `<img>` source the send path turns into a part, for measuring a body without
// those bytes. Anything else counts as markup: a base64 run elsewhere (record values can't form
// `<img`), an unclosed quote, or a type that is never sent. So the cap bounds what gets sanitized.
// Anchored on `src=` so the scan stays linear: it runs on every workflow save, before any cap.
// Whether the `src` belongs to an `<img>` is checked separately (`isInsideImgTag`).
const DATA_IMAGE_SRC_PAYLOAD =
  /(\bsrc\s{0,16}=\s{0,16})(["'])data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]*\2/gi;

const IMG_TAG_OPENING = /^<img\b[^>]*$/i;

/** Whether `offset` sits inside an `<img` tag, looking back no more than 512 chars. */
function isInsideImgTag(body: string, offset: number): boolean {
  const window = body.slice(Math.max(0, offset - 512), offset);
  const tagStart = window.lastIndexOf('<');
  return tagStart !== -1 && IMG_TAG_OPENING.test(window.slice(tagStart));
}

// Base64 of the inline image cap, with room for line breaks inside the payloads.
const MAX_EMAIL_IMAGE_PAYLOAD_LENGTH =
  Math.ceil((MAX_EMAIL_INLINE_IMAGES_SIZE * 4) / 3) + 64 * 1024;

/** A body's length without its image payloads (what the markup cap applies to), and theirs. */
function measureEmailBody(body: string): { markup: number; payload: number } {
  let payload = 0;
  const markup = body.replace(
    DATA_IMAGE_SRC_PAYLOAD,
    (match, prefix: string, quote: string, offset: number) => {
      if (!isInsideImgTag(body, offset)) return match;
      const kept = `${prefix}${quote}${quote}`;
      payload += match.length - kept.length;
      return kept;
    },
  ).length;
  return { markup, payload };
}

function inlineImagesTooLargeError(): Error {
  return new Error(
    `Images in the email body exceed the ${formatMb(MAX_EMAIL_INLINE_IMAGES_SIZE)} limit. Use smaller images — a logo is usually well under 100 KB.`,
  );
}

/** Scheme of body images stored as NocoDB files: `src="nc-file:<file_url>"`. */
export const EMAIL_FILE_IMAGE_SCHEME = 'nc-file:';

const FILE_IMAGE_SRC =
  /(<img\b[^>]{0,512}?\bsrc\s{0,16}=\s{0,16})(["'])nc-file:([^"']{1,2048})\2/gi;

/** Extensions a stored body image may have; the editor only accepts files with one of these. */
const IMAGE_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Bytes of a stored body image, loaded by the node before the body is prepared. */
export interface EmailBodyImageFile {
  content: Buffer;
  contentType: string;
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Image type for a stored file, from its extension; undefined when it is not one we send inline. */
export function emailImageTypeForFile(fileUrl: string): string | undefined {
  const ext = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(fileUrl)?.[1]?.toLowerCase();
  return ext ? IMAGE_TYPE_BY_EXT[ext] : undefined;
}

/** `file_url`s of the stored images a body references, deduplicated. */
export function collectEmailBodyImageRefs(body: unknown): string[] {
  if (typeof body !== 'string' || !body.includes(EMAIL_FILE_IMAGE_SCHEME)) {
    return [];
  }
  // A body past the markup cap can't be sent, so its references never matter; skipping it keeps
  // the scan bounded wherever it runs (workflow saves included).
  if (measureEmailBody(body).markup > MAX_EMAIL_HTML_BODY_LENGTH) return [];
  const refs = new Set<string>();
  for (const match of body.matchAll(FILE_IMAGE_SRC)) {
    refs.add(decodeAttr(match[3]));
  }
  return [...refs];
}

/**
 * Mail clients block remote images by default, so each body image becomes a Content-ID part and
 * the `img` points at `cid:` instead. Stored images (`nc-file:`) take their bytes from `files`;
 * `data:` URIs carry their own. Identical images share one part. A source with no usable bytes
 * is left as-is, and the sanitizer drops it with its `img`.
 */
export function extractInlineImages(
  html: string,
  files: Map<string, EmailBodyImageFile> = new Map(),
): {
  html: string;
  images: EmailInlineImage[];
} {
  const images: EmailInlineImage[] = [];
  const byKey = new Map<string, string>();
  let size = 0;

  const addImage = (key: string, contentType: string, content: Buffer) => {
    const existing = byKey.get(key);
    if (existing) return existing;

    if (images.length >= MAX_EMAIL_INLINE_IMAGES) {
      throw new Error(
        `Email body has more than ${MAX_EMAIL_INLINE_IMAGES} images. Remove some images from the body.`,
      );
    }

    size += content.length;
    if (size > MAX_EMAIL_INLINE_IMAGES_SIZE) {
      throw inlineImagesTooLargeError();
    }

    const cid = `image${images.length + 1}@nocodb`;
    byKey.set(key, cid);
    images.push({
      cid,
      filename: `image${images.length + 1}.${INLINE_IMAGE_TYPES[contentType]}`,
      contentType,
      content,
    });
    return cid;
  };

  const out = html
    .replace(
      DATA_IMAGE_SRC,
      (match, prefix: string, quote: string, type: string, data: string) => {
        const contentType = type.toLowerCase();
        if (!INLINE_IMAGE_TYPES[contentType]) return match;
        const base64 = data.replace(/\s+/g, '');
        const content = Buffer.from(base64, 'base64');
        if (!content.length) return match;
        const cid = addImage(`data:${contentType};${base64}`, contentType, content);
        return `${prefix}${quote}cid:${cid}${quote}`;
      },
    )
    .replace(FILE_IMAGE_SRC, (match, prefix: string, quote: string, ref: string) => {
      const fileUrl = decodeAttr(ref);
      const file = files.get(fileUrl);
      if (!file?.content.length || !INLINE_IMAGE_TYPES[file.contentType]) {
        return match;
      }
      const cid = addImage(`file:${fileUrl}`, file.contentType, file.content);
      return `${prefix}${quote}cid:${cid}${quote}`;
    });

  return { html: out, images };
}

function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
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

  // A `cid:` reference means nothing in plain text.
  if (el.tagName === 'IMG') return '';

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
  const root = getPurify().sanitize(html, {
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
  /** Images the HTML references by `cid:`; each must be sent as an inline part */
  inlineImages?: EmailInlineImage[];
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
  opts: {
    isHtml: boolean;
    /** Bytes for the body's stored images, keyed by `file_url` (see `resolveEmailBodyImages`). */
    images?: Map<string, EmailBodyImageFile>;
  },
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

  // The length limit is about markup the parser must walk; image bytes have their own cap. Both
  // run before extraction, whose regexes scan every `<img`, so their input stays bounded too.
  const size = measureEmailBody(body);
  if (size.markup > MAX_EMAIL_HTML_BODY_LENGTH) {
    throw new Error(
      `Email body exceeds the ${Math.floor(MAX_EMAIL_HTML_BODY_LENGTH / 1000)} KB limit for rich-text content`,
    );
  }
  if (size.payload > MAX_EMAIL_IMAGE_PAYLOAD_LENGTH) {
    throw inlineImagesTooLargeError();
  }

  const extracted = extractInlineImages(body, opts.images);

  const sanitized = sanitizeEmailHtml(extracted.html, {
    baseStyles: true,
    inlineCids: extracted.images.map((image) => image.cid),
  });
  const html = `<div style="${EMAIL_BODY_STYLE}">${sanitized}</div>`;
  // An image the sanitizer removed (e.g. inside a stripped element) must not ride along.
  const inlineImages = extracted.images.filter((image) =>
    sanitized.includes(`cid:${image.cid}`),
  );
  return {
    isHtml: true,
    html,
    text: htmlToPlainText(sanitized),
    inlineImages,
  };
}
