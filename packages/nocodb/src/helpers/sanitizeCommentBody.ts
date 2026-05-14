import DOMPurify from 'isomorphic-dompurify';

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

export function sanitizeCommentBody(input: unknown): string {
  if (input == null) return '';
  return DOMPurify.sanitize(String(input), COMMENT_SANITIZE_CONFIG);
}
