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
function computeDiffDecorations(
  state: DocDiffState,
  schema: Schema,
  currentDoc: PMNode,
): DecorationSet {
  if (!state.enabled || !state.fromContent || !state.toContent) {
    return DecorationSet.empty
  }

  let fromDoc: PMNode
  let toDoc: PMNode
  try {
    fromDoc = PMNode.fromJSON(schema, state.fromContent)
    toDoc = PMNode.fromJSON(schema, state.toContent)
  } catch {
    return DecorationSet.empty
  }

  let changes: ChangeSet
  try {
    // Express the entire content as a single replace StepMap: remove the
    // full "from" doc body and insert the full "to" doc body. ChangeSet
    // walks both structures token by token and reports inserted / deleted
    // ranges via its inner LCS — token-level precision without us needing
    // intermediate steps.
    const map = new StepMap([0, fromDoc.content.size, toDoc.content.size])
    changes = ChangeSet.create(fromDoc).addSteps(toDoc, [map], null)
  } catch {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []

  for (const change of changes.changes) {
    // change.inserted is an array of `Span { length, data }`. Their lengths
    // sum to (toB - fromB). We mark the entire inserted range as one
    // decoration — finer span-by-span treatment is a future refinement.
    if (change.toB > change.fromB) {
      decorations.push(
        Decoration.inline(change.fromB, change.toB, {
          class: 'nc-doc-history-diff-insert',
        }),
      )
    }
  }

  // Decorations are anchored to currentDoc (which is the same as toDoc when
  // the plugin runs against an idle editor). We pass currentDoc so PM
  // computes positions against the actual editor state — avoids the rare
  // mismatch when the editor re-parses an identical JSON differently.
  return DecorationSet.create(currentDoc, decorations)
}

/**
 * Plugin that renders an inline-insert decoration overlay. The viewer
 * dispatches an empty meta transaction with `{[docDiffPluginKey]: nextState}`
 * to recompute on prop changes.
 */
export function docDiffPlugin(initial: DocDiffState) {
  return new Plugin<DocDiffState>({
    key: docDiffPluginKey,
    state: {
      init: () => initial,
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(docDiffPluginKey) as Partial<DocDiffState> | undefined
        if (meta) return { ...value, ...meta }
        if (tr.docChanged) return { ...value, toContent: newState.doc.toJSON() }
        return value
      },
    },
    props: {
      decorations(editorState) {
        const state = docDiffPluginKey.getState(editorState)
        if (!state) return DecorationSet.empty
        return computeDiffDecorations(state, editorState.schema, editorState.doc)
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
      } as DocDiffState,
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
  next: Partial<DocDiffState>,
) {
  if (!editor) return
  const tr = editor.view.state.tr.setMeta(docDiffPluginKey, next)
  editor.view.dispatch(tr)
}
