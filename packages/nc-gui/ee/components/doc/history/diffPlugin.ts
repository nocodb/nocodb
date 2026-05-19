import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node as PMNode, type Schema } from '@tiptap/pm/model'
import { StepMap } from '@tiptap/pm/transform'
import { ChangeSet } from 'prosemirror-changeset'

/**
 * State injected via the plugin key. The viewer updates this every time
 * the comparison basis or the previewed revision changes.
 */
export interface DocDiffState {
  /** "From" doc — the older / current version we're diffing against. */
  fromContent: Record<string, any> | null
  /** "To" doc — what the editor is currently rendering. */
  toContent: Record<string, any> | null
  /** When false, the plugin emits an empty decoration set (no highlighting). */
  enabled: boolean
  /**
   * Which change is "focused" in the step-through nav. The decoration at this
   * index gets an extra `nc-doc-history-diff-insert-current` class so it's
   * visually distinct from the rest. -1 = no focus.
   */
  currentIndex: number
  /**
   * Cached decoration set + change positions. Computed inside `apply` so that
   * `props.decorations` is a trivial read, and so the viewer's step-through
   * nav can read positions via `getDiffChanges()` without recomputing.
   */
  decorations: DecorationSet
  changes: DocDiffChange[]
}

export interface DocDiffChange {
  from: number
  to: number
}

export const docDiffPluginKey = new PluginKey<DocDiffState>('docHistoryDiff')

/**
 * Compute decorations on the "to" doc (what's rendered) showing inserted
 * ranges in green. Deletions are intentionally skipped in v1 — rendering
 * deleted content inline would require a widget that mounts the prior
 * node, which adds complexity not yet justified.
 *
 * Returns an empty DecorationSet when:
 *   - the plugin is disabled
 *   - `fromContent` is missing (initial creation — no prior to compare)
 *   - either doc fails to parse against the schema
 */
/**
 * Find inserted ranges in the "to" doc relative to the "from" doc.
 * Returns an empty array when:
 *   - the plugin is disabled
 *   - `fromContent` is missing (initial creation — no prior to compare)
 *   - either doc fails to parse against the schema
 */
function findChanges(
  fromContent: Record<string, any> | null,
  toContent: Record<string, any> | null,
  enabled: boolean,
  schema: Schema,
): DocDiffChange[] {
  if (!enabled || !fromContent || !toContent) return []

  let fromDoc: PMNode
  let toDoc: PMNode
  try {
    fromDoc = PMNode.fromJSON(schema, fromContent)
    toDoc = PMNode.fromJSON(schema, toContent)
  } catch {
    return []
  }

  let changeset: ChangeSet
  try {
    // Express the entire content as a single replace StepMap: remove the
    // full "from" doc body and insert the full "to" doc body. ChangeSet
    // walks both structures token by token and reports inserted / deleted
    // ranges via its inner LCS — token-level precision without us needing
    // intermediate steps.
    const map = new StepMap([0, fromDoc.content.size, toDoc.content.size])
    changeset = ChangeSet.create(fromDoc).addSteps(toDoc, [map], null)
  } catch {
    return []
  }

  const changes: DocDiffChange[] = []
  for (const change of changeset.changes) {
    if (change.toB > change.fromB) {
      changes.push({ from: change.fromB, to: change.toB })
    }
  }
  return changes
}

/**
 * Build decorations from a list of change ranges, marking one as "current"
 * so the step-through nav has a visible focus.
 */
function buildDecorations(
  changes: DocDiffChange[],
  currentIndex: number,
  currentDoc: PMNode,
): DecorationSet {
  if (!changes.length) return DecorationSet.empty
  const decorations = changes.map((change, idx) =>
    Decoration.inline(change.from, change.to, {
      class:
        idx === currentIndex
          ? 'nc-doc-history-diff-insert nc-doc-history-diff-insert-current'
          : 'nc-doc-history-diff-insert',
    }),
  )
  return DecorationSet.create(currentDoc, decorations)
}

/**
 * Plugin that renders an inline-insert decoration overlay. The viewer
 * dispatches an empty meta transaction with `{[docDiffPluginKey]: nextState}`
 * to recompute on prop changes.
 *
 * Decorations + positions are cached in plugin state so `props.decorations`
 * stays cheap and external callers (the step-through nav) can read change
 * positions via `getDiffChanges()` without re-running the diff.
 */
export function docDiffPlugin(initial: Omit<DocDiffState, 'decorations' | 'changes'>) {
  return new Plugin<DocDiffState>({
    key: docDiffPluginKey,
    state: {
      init(_, editorState) {
        const changes = findChanges(
          initial.fromContent,
          initial.toContent,
          initial.enabled,
          editorState.schema,
        )
        const decorations = buildDecorations(
          changes,
          initial.currentIndex,
          editorState.doc,
        )
        return { ...initial, changes, decorations }
      },
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(docDiffPluginKey) as
          | Partial<DocDiffState>
          | undefined

        // Determine whether the underlying diff inputs changed (rerun the
        // LCS) vs only the focused-change index (cheap rebuild). Doc edits
        // here are rare since the viewer is read-only, but a content swap
        // via setContent fires a docChanged transaction.
        const inputChanged =
          !!meta &&
          ('fromContent' in meta || 'toContent' in meta || 'enabled' in meta)
        const indexOnlyChanged =
          !!meta && !inputChanged && 'currentIndex' in meta
        const docChanged = tr.docChanged

        const next: DocDiffState = { ...value, ...(meta ?? {}) }
        if (docChanged) next.toContent = newState.doc.toJSON()

        if (inputChanged || docChanged) {
          next.changes = findChanges(
            next.fromContent,
            next.toContent,
            next.enabled,
            newState.schema,
          )
          next.decorations = buildDecorations(
            next.changes,
            next.currentIndex,
            newState.doc,
          )
        } else if (indexOnlyChanged) {
          next.decorations = buildDecorations(
            value.changes,
            next.currentIndex,
            newState.doc,
          )
        } else {
          // Unrelated transactions (selection, focus) — just map decorations.
          next.decorations = value.decorations.map(tr.mapping, tr.doc)
        }
        return next
      },
    },
    props: {
      decorations(editorState) {
        return docDiffPluginKey.getState(editorState)?.decorations ?? DecorationSet.empty
      },
    },
  })
}

/**
 * TipTap-friendly wrapper around the diff plugin. Add this to the
 * extensions array; control its state via the exported helpers below.
 */
export const DocDiffExtension = Extension.create({
  name: 'docHistoryDiff',
  addOptions() {
    return {
      initialState: {
        fromContent: null,
        toContent: null,
        enabled: false,
        currentIndex: 0,
      } as Omit<DocDiffState, 'decorations' | 'changes'>,
    }
  },
  addProseMirrorPlugins() {
    return [docDiffPlugin(this.options.initialState)]
  },
})

/**
 * Helper to push new diff state into a running editor. Called from the
 * viewer whenever the comparison basis or the previewed revision changes.
 */
export function setDocDiffState(
  editor: { view: { state: any; dispatch: (tr: any) => void } } | null | undefined,
  next: Partial<Omit<DocDiffState, 'decorations' | 'changes'>>,
) {
  if (!editor) return
  const tr = editor.view.state.tr.setMeta(docDiffPluginKey, next)
  editor.view.dispatch(tr)
}

/**
 * Read the cached list of change positions out of plugin state. Returns
 * an empty array when the plugin is disabled or there are no changes.
 */
export function getDiffChanges(
  editor: { view: { state: any } } | null | undefined,
): DocDiffChange[] {
  if (!editor) return []
  return docDiffPluginKey.getState(editor.view.state)?.changes ?? []
}

/**
 * Scroll the editor's viewport to the given change index. No-op when the
 * index is out of range. Used by the step-through nav (↑/↓ buttons).
 */
export function scrollToDiffChange(
  editor: { view: any } | null | undefined,
  index: number,
): void {
  if (!editor) return
  const changes = getDiffChanges(editor)
  const change = changes[index]
  if (!change) return

  const view = editor.view
  // Use the native DOM node at the change's start position so we can call
  // `scrollIntoView` with smooth behavior — TR-based `scrollIntoView` jumps
  // abruptly and forces a focus side-effect we don't want in a read-only
  // viewer.
  try {
    const { node } = view.domAtPos(change.from)
    const el = (node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    // ignore — out-of-range or detached node
  }
}
