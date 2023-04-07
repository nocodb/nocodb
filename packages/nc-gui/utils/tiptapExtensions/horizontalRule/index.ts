import HorizontalTiptapRule from '@tiptap/extension-horizontal-rule'
import type { Editor } from '@tiptap/vue-3'
import { Plugin, PluginKey } from 'prosemirror-state'

// This function is used on Document tiptap node to handle backspace key
// As Backspace of this extension is not working properly
// All shortcuts of divider are handled on Document node
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

export const onEnterWithHorizontalRule = (editor: Editor) => {
  try {
    const currentNode = editor.view.state.selection.$from.node()
    const childNode = editor.view.state.selection.$from.node().child(0)

    if (currentNode.type.name !== 'horizontalRule' && childNode?.type.name !== 'horizontalRule') return false

    const nextNodePos = editor.view.state.selection.$from.after(editor.view.state.selection.$from.depth)

    return editor
      .chain()
      .setTextSelection(nextNodePos + 1)
      .run()
  } catch {
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
            const prevNode = view.state.doc.nodeAt(pos - 1)

            if (currentNode?.type.name !== 'horizontalRule' && prevNode?.type.name !== 'horizontalRule') return false

            if (currentNode?.type.name === 'horizontalRule') {
              this.editor.chain().setNodeSelection(pos).run()
            } else {
              setTimeout(() => {
                this.editor
                  .chain()
                  .setNodeSelection(pos - 1)
                  .run()
              })
            }

            return true
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
