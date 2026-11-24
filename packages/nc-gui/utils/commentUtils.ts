import type { CommentType } from 'nocodb-sdk'
import { decode as decodeHtmlEntities } from 'html-entities'

/** One-line text of a comment for previews (pinned bar, resolved row); render it as text, not HTML. */
export function commentPlainText(commentItem: Pick<CommentType, 'comment'>) {
  const text = (commentItem.comment ?? '')
    .replace(/@\(([^)]+)\)/g, (_match, inner: string) => {
      const [, email, name] = inner.split('|')
      return `@${name || email || ''}`
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Stored comments escape `<` as `&lt;`; decode last so a decoded `<b>` stays text.
  return decodeHtmlEntities(text, { scope: 'strict' })
}
