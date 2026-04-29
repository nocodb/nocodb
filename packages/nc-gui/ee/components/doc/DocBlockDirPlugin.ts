/**
 * ProseMirror plugin that decorates every block-level node with
 * `dir="auto"`, mirroring how Notion renders body blocks. Each paragraph,
 * heading, list-item, blockquote, table cell, etc. picks its own direction
 * from its first strong character — so a doc cleanly mixes LTR and RTL
 * content without any per-block UI or stored attribute.
 *
 * The plugin doesn't touch the wrapper or the page title; those keep their
 * own direction handling in Editor.vue.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const blockDirPluginKey = new PluginKey<DecorationSet>('blockDir')

const buildDecorations = (doc: any): DecorationSet => {
  const decos: Decoration[] = []
  doc.descendants((node: any, pos: number) => {
    if (!node.isBlock) return
    decos.push(Decoration.node(pos, pos + node.nodeSize, { dir: 'auto' }))
  })
  return DecorationSet.create(doc, decos)
}

const blockDirPlugin = new Plugin<DecorationSet>({
  key: blockDirPluginKey,

  state: {
    init(_, { doc }) {
      return buildDecorations(doc)
    },
    apply(tr, decorationSet, _oldState, newState) {
      if (tr.docChanged) return buildDecorations(newState.doc)
      return decorationSet.map(tr.mapping, tr.doc)
    },
  },

  props: {
    decorations(state) {
      return blockDirPluginKey.getState(state)
    },
  },
})

export const DocBlockDirExtension = Extension.create({
  name: 'blockDir',

  addProseMirrorPlugins() {
    return [blockDirPlugin]
  },
})
