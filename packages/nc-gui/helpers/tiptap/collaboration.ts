import Collaboration from '@tiptap/extension-collaboration'
import type { Plugin } from '@tiptap/pm/state'
import { yUndoPluginKey } from 'y-prosemirror'

/**
 * Collaboration, with redo kept alive.
 *
 * A Yjs UndoManager tracks its own transactions — that self-tracking is what turns an undo
 * into a redo stack item. y-prosemirror's undo plugin destroys the manager whenever its
 * plugin view is torn down (`undoManager.destroy()` drops it from `trackedOrigins`), and
 * ProseMirror tears every plugin view down on each plugin-set change: attaching the editor
 * to its element, a `<BubbleMenu>` registering, any `registerPlugin`/`unregisterPlugin`.
 * @tiptap/extension-collaboration restores it from a one-shot `restore` hook that a
 * re-entrant teardown can arm with a stale "was it self-tracked" flag — after two such
 * changes the manager is never self-tracked again, and redo silently does nothing for the
 * rest of the session (undo keeps working, which is why this reads as a redo bug).
 *
 * A live undo plugin view always means a live undo manager, so re-assert it on every view.
 */
export const NcCollaboration = Collaboration.extend({
  addProseMirrorPlugins() {
    const plugins: Plugin[] = this.parent?.() ?? []

    for (const plugin of plugins) {
      if (plugin.spec?.key !== yUndoPluginKey) continue

      const createView = plugin.spec.view
      plugin.spec.view = (view) => {
        const pluginView = createView?.(view)
        const undoManager = yUndoPluginKey.getState(view.state)?.undoManager
        undoManager?.trackedOrigins.add(undoManager)
        return pluginView ?? {}
      }
    }

    return plugins
  },
})
