/**
 * Shared helpers for normalizing document (ProseMirror) content before it
 * reaches the tiptap editor.
 *
 * The backend should hand back parsed PM JSON (see Document.get), but content
 * can still arrive as a stringified JSON column (SQLite text vs PG jsonb),
 * `null` (a brand-new doc), or malformed/empty data. tiptap's `setContent`
 * rejects anything that isn't a structurally valid `doc` node — its content
 * expression is `block+`, so `{}` / `{ content: [] }` throw. These helpers
 * guarantee a valid doc so no call site has to guard against `null` or a bare
 * empty object.
 */

/** Minimal valid PM document — one empty paragraph. Matches the default used
 *  by the editor cell-mode watcher and the public-docs backend service. */
export const emptyDocContent = (): Record<string, any> => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
})

/**
 * Normalize raw content (object | stringified JSON | null) into a valid PM doc.
 * Never returns `null` or a bare `{}` — falls back to {@link emptyDocContent}.
 */
export function parseDocContent(content: unknown): Record<string, any> {
  if (!content) return emptyDocContent()

  if (ncIsObject(content)) {
    return ncIsEmptyObject(content) ? emptyDocContent() : (content as Record<string, any>)
  }

  if (ncIsString(content)) {
    try {
      const parsed = JSON.parse(content)
      return ncIsObject(parsed) && !ncIsEmptyObject(parsed) ? parsed : emptyDocContent()
    } catch {
      return emptyDocContent()
    }
  }

  return emptyDocContent()
}
