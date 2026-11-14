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

/** Closed fenced code blocks, found line by line. An unclosed fence is left to be escaped. */
function findFences(input: string): Array<[number, number]> {
  const fences: Array<[number, number]> = [];
  let open: { char: string; len: number; start: number } | null = null;
  let offset = 0;
  for (const line of input.split('\n')) {
    const lineEnd = offset + line.length;
    if (!open) {
      const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      const info = m ? line.slice(m[0].length) : '';
      if (m && !(m[1][0] === '`' && info.includes('`'))) {
        open = { char: m[1][0], len: m[1].length, start: offset };
      }
    } else {
      const m = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
      if (m && m[1][0] === open.char && m[1].length >= open.len) {
        fences.push([open.start, lineEnd]);
        open = null;
      }
    }
    offset = lineEnd + 1;
  }
  return fences;
}

/**
 * Markdown code spans and fenced blocks. Conservative: anything not found here
 * is escaped like plain text, which is safe (only cosmetic inside code).
 * Linear in the input: comments reach this unbounded (doc comments, import).
 */
function findCodeSegments(input: string): Array<[number, number]> {
  const fences = findFences(input);
  const segments: Array<[number, number]> = [...fences];
  const unclosedRuns = new Set<number>();

  let fi = 0;
  let i = 0;
  while (i < input.length) {
    while (fi < fences.length && fences[fi][1] <= i) fi++;
    if (fi < fences.length && fences[fi][0] <= i) {
      i = fences[fi][1];
      continue;
    }
    if (input[i] !== '`') {
      i++;
      continue;
    }
    let run = 0;
    while (input[i + run] === '`') run++;

    let slashes = 0;
    for (let j = i - 1; j >= 0 && input[j] === '\\'; j--) slashes++;
    if (slashes % 2 === 1 || unclosedRuns.has(run)) {
      i += run;
      continue;
    }

    const closer = new RegExp(`(?<!\`)\`{${run}}(?!\`)`, 'g');
    closer.lastIndex = i + run;
    const close = closer.exec(input);
    if (!close) {
      unclosedRuns.add(run);
      i += run;
      continue;
    }
    const end = close.index + run;
    const crossesFence = fi < fences.length && fences[fi][0] < end;
    if (!crossesFence && !/\n[ \t]*\n/.test(input.slice(i, end))) {
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
  let inTag = false;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (c === '<') {
      const name = /^<([!?]|\/?[a-z][^\s/>]*)/i.exec(segment.slice(i, i + 64));
      if (!name) continue;
      if (name[1] === '!' || name[1] === '?') return false;
      if (RAW_TEXT_OR_ACTIVE_TAGS.has(name[1].replace('/', '').toLowerCase()))
        return false;
      inTag = true;
    } else if (inTag && c === '=') {
      return false;
    } else if (c === '>') {
      inTag = false;
    }
  }
  return !inTag;
}

/**
 * A raw HTML tag at the start of a line can open a markdown HTML block, where
 * backticks are not code. Only a mid-line `<br>` is known not to.
 */
function mayOpenHtmlBlock(text: string): boolean {
  let lineStart = 0;
  let lastIndex = 0;
  for (const m of text.matchAll(/<(\/?[a-z0-9]+)/gi)) {
    if (m[1].toLowerCase() !== 'br') return true;
    const nl = text.slice(lastIndex, m.index).lastIndexOf('\n');
    if (nl !== -1) lineStart = lastIndex + nl + 1;
    lastIndex = m.index;
    if (/^[\s>*+\-\d.)]*$/.test(text.slice(lineStart, m.index))) return true;
    lineStart = m.index;
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
  let out = '';
  let pos = 0;
  let insideTag = false;
  for (const m of sanitized.matchAll(
    new RegExp(`nccode${nonce}i(\\d+)x`, 'g'),
  )) {
    for (let k = pos; k < m.index; k++) {
      if (sanitized[k] === '<') insideTag = true;
      else if (sanitized[k] === '>') insideTag = false;
    }
    const segment = code[Number(m[1])];
    out +=
      sanitized.slice(pos, m.index) +
      (keepRaw && !insideTag && isHtmlInert(segment)
        ? segment
        : escapeHtml(segment));
    pos = m.index + m[0].length;
  }
  return out + sanitized.slice(pos);
}
