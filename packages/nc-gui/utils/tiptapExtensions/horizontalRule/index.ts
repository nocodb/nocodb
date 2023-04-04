import HorizontalTiptapRule from '@tiptap/extension-horizontal-rule'
import type { Editor } from '@tiptap/vue-3'
import { Plugin, PluginKey } from 'prosemirror-state'

// This function is used on Document tiptap node to handle backspace key
// As Backspace of this extension is not working properly
export const onBackspaceWithHorizontalRule = (editor: Editor) => {
  try {
    const selection = editor.view.state.selection
    const node = selection.$from.node()
    const parentNode = selection.$from.node(-1)

    if (!(node.type.name === 'paragraph' && parentNode.type.name === 'dBlock')) {
      return false
    }

    const prevNodePos = selection.$from.pos - (parentNode.nodeSize - node.nodeSize + 2)
    const prevNode = editor.view.state.doc.nodeAt(prevNodePos)

    if (prevNode?.type.name === 'horizontalRule') {
      editor.chain().setNodeSelection(prevNodePos).run()
      return true
    }

    return false
  } catch (error) {
    console.log('error', error)
    return false
  }
}

export const HorizontalRule = HorizontalTiptapRule.extend({
  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name)
    return [
      new Plugin({
        plugin,
        props: {
          handleClick: (view, pos) => {
            const currentNode = view.state.doc.nodeAt(pos)

            if (currentNode?.type.name !== 'horizontalRule') return false

            this.editor.chain().setNodeSelection(pos).run()
          },
        },
      }),
    ]
  },
}).configure({
  HTMLAttributes: {
    class: 'nc-docs-horizontal-rule',
  },
})
