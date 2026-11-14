import { randomBytes } from 'crypto';
import { getDOMPurify } from '~/helpers/domPurify';

/**
 * Allowlist of tags / attributes permitted in row + document comments.
 * Anything outside this set is stripped before the comment reaches the
 * database.
 */
export const COMMENT_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'span',
    'a',
    'b',
    'i',
    'u',
    'strong',
    'em',
    'br',
    'ul',
    'ol',
    'li',
    'code',
    'pre',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ],
  ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
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

// Allowlisted tags that only count as markup when written bare (`<b>`, `</b>`, `<br/>`).
const BARE_TAGS = COMMENT_SANITIZE_CONFIG.ALLOWED_TAGS.filter(
  (t) => !['a', 'span', 'p', 'code', 'pre'].includes(t),
);

// A `<` that does not open an allowlisted tag is text, e.g. `Name <a@b.com>` or `Array<string>`.
const NON_TAG_LT = new RegExp(
  `<(?!/?(?:(?:${BARE_TAGS.join(
    '|',
  )})\\s*/?>|(?:a|span|p|code|pre)(?:\\s[^<>]*)?/?>))`,
  'gi',
);

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Markdown code spans and fenced blocks. Conservative: anything not found here
 * is escaped like plain text, which is safe (only cosmetic inside code).
 */
function findCodeSegments(input: string): Array<[number, number]> {
  const segments: Array<[number, number]> = [];

  const fence =
    /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n {0,3}\1[`~]*[ \t]*(?=\n|$)/gm;
  for (const m of input.matchAll(fence)) {
    segments.push([m.index, m.index + m[0].length]);
  }

  const fences = [...segments];
  const inFence = (i: number) => fences.some(([s, e]) => i >= s && i < e);
  const crossesFence = (a: number, b: number) =>
    fences.some(([s, e]) => s < b && e > a);
  let i = 0;
  while (i < input.length) {
    if (input[i] !== '`' || inFence(i)) {
      i++;
      continue;
    }
    let run = 0;
    while (input[i + run] === '`') run++;

    let slashes = 0;
    for (let j = i - 1; j >= 0 && input[j] === '\\'; j--) slashes++;
    if (slashes % 2 === 1) {
      i += run;
      continue;
    }

    const closer = new RegExp(`(?<!\`)\`{${run}}(?!\`)`, 'g');
    closer.lastIndex = i + run;
    const close = closer.exec(input);
    const end = close ? close.index + run : -1;
    if (
      close &&
      !crossesFence(i, end) &&
      !/\n[ \t]*\n/.test(input.slice(i, end))
    ) {
      segments.push([i, end]);
      i = end;
    } else {
      i += run;
    }
  }

  return segments.sort((a, b) => a[0] - b[0]);
}

const RAW_TEXT_OR_ACTIVE_TAGS = new Set([
  'script',
  'style',
  'svg',
  'math',
  'iframe',
  'frame',
  'frameset',
  'noscript',
  'noembed',
  'noframes',
  'template',
  'textarea',
  'title',
  'xmp',
  'plaintext',
  'object',
  'embed',
  'base',
  'meta',
  'link',
  'form',
]);

/**
 * Code kept verbatim must stay harmless if a consumer renders the stored value
 * as HTML: every tag-like run needs a closing `>` inside the segment, no `=`
 * (so no attribute values) and a name outside RAW_TEXT_OR_ACTIVE_TAGS.
 * `Array<string>` and `Map<K, V>` pass.
 */
function isHtmlInert(segment: string): boolean {
  for (const m of segment.matchAll(/<([!?/]?)([a-z][^\s/>]*)?/gi)) {
    if (m[1] === '!' || m[1] === '?') return false;
    if (!m[2]) continue;
    const close = segment.indexOf('>', m.index);
    if (close === -1) return false;
    if (segment.slice(m.index, close).includes('=')) return false;
    if (RAW_TEXT_OR_ACTIVE_TAGS.has(m[2].toLowerCase())) return false;
  }
  return true;
}

/**
 * A raw HTML tag at the start of a line can open a markdown HTML block, where
 * backticks are not code. Only a mid-line `<br>` is known not to.
 */
function mayOpenHtmlBlock(text: string): boolean {
  for (const m of text.matchAll(/<(\/?[a-z0-9]+)/gi)) {
    if (m[1].toLowerCase() !== 'br') return true;
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    if (/^[\s>*+\-\d.)]*$/.test(text.slice(lineStart, m.index))) return true;
  }
  return false;
}

export function sanitizeCommentBody(input: unknown): string {
  if (input == null) return '';
  const raw = String(input);

  const nonce = randomBytes(6).toString('hex');
  const code: string[] = [];
  let text = '';
  let cursor = 0;
  for (const [start, end] of findCodeSegments(raw)) {
    text += raw.slice(cursor, start) + `nccode${nonce}i${code.length}x`;
    code.push(raw.slice(start, end));
    cursor = end;
  }
  text += raw.slice(cursor);

  const sanitized = getDOMPurify().sanitize(
    text.replace(NON_TAG_LT, '&lt;'),
    COMMENT_SANITIZE_CONFIG,
  );

  // Code is kept as typed only where markdown will render it as code.
  const keepRaw = !mayOpenHtmlBlock(sanitized);
  return sanitized.replace(
    new RegExp(`nccode${nonce}i(\\d+)x`, 'g'),
    (_, idx: string, offset: number) => {
      const segment = code[Number(idx)];
      const insideTag =
        sanitized.lastIndexOf('<', offset) > sanitized.lastIndexOf('>', offset);
      return keepRaw && !insideTag && isHtmlInert(segment)
        ? segment
        : escapeHtml(segment);
    },
  );
}
