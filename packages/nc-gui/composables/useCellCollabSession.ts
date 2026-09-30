import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'

export interface CellCollabSessionUser {
  id: string
  name: string
  color: string
}

export interface CellCollabSession {
  /** False when any prerequisite is missing — the editor then behaves exactly as before. */
  active: boolean
  ydoc: Y.Doc | null
  awareness: Awareness | null
  synced: Ref<boolean>
  /** A real server frame arrived. Distinct from `synced`, which also flips on a local timeout. */
  serverAcked: Ref<boolean>
  /** The server refused the subscribe — no session is coming. */
  refused: Ref<boolean>
  /** Server said this socket may read but not write. Defence in depth. */
  readOnly: Ref<boolean>
  mayBootstrap: Ref<boolean>
  user: CellCollabSessionUser | null
  destroy: () => void
}

/**
 * CE stub. Ephemeral co-editing is EE-only, so in CE the session is always
 * inactive and every Long Text editor keeps its existing single-writer
 * behaviour. The EE overlay (`ee/composables/useCellCollabSession.ts`) provides
 * the real implementation and declares this same shape — it cannot import it
 * from here, because `~/` resolves EE-first from `ee/` and the alias would point
 * back at the overlay itself.
 */
export function useCellCollabSession(_params: {
  tableId?: string | null
  rowId?: string | null
  columnId?: string | null
  workspaceId?: string | null
  baseId?: string | null
}): CellCollabSession {
  return {
    active: false,
    ydoc: null,
    awareness: null,
    synced: ref(false),
    serverAcked: ref(false),
    refused: ref(false),
    readOnly: ref(false),
    mayBootstrap: ref(false),
    user: null,
    destroy: () => {},
  }
}
