/**
 * ProseMirror plugin that adds an `nc-active-block` class to a
 * horizontal rule (divider) when the cursor is on it.
 *
 * Dividers are non-editable leaf nodes — without visual feedback
 * it's unclear when one is selected. This plugin adds a class so
 * CSS can show a selection border.
 */
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Extension } from '@tiptap/core'

const activeBlockPluginKey = new PluginKey('activeBlock')

const activeBlockPlugin = new Plugin({
  key: activeBlockPluginKey,

  state: {
    init(_, { doc, selection }) {
      return buildDecorations(doc, selection)
    },
    apply(tr, decorationSet, _oldState, newState) {
      if (tr.docChanged || tr.selectionSet) {
        return buildDecorations(newState.doc, newState.selection)
      }
      return decorationSet.map(tr.mapping, tr.doc)
    },
  },

  props: {
    decorations(state) {
      return activeBlockPluginKey.getState(state)
    },
  },
})

function buildDecorations(doc: any, selection: any): DecorationSet {
  // NodeSelection is used when a non-editable node (like hr) is selected
  if (selection.node?.type.name !== 'horizontalRule') return DecorationSet.empty

  const decoration = Decoration.node(selection.from, selection.to, {
    class: 'nc-active-block',
  })

  return DecorationSet.create(doc, [decoration])
}

export const DocActiveBlockExtension = Extension.create({
  name: 'activeBlock',

  addProseMirrorPlugins() {
    return [activeBlockPlugin]
  },
})
