import HorizontalTiptapRule from '@tiptap/extension-horizontal-rule'

export const HorizontalRule = HorizontalTiptapRule.extend({
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
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
            editor.chain().setNodeSelection(prevNodePos).deleteSelection().run()
            return true
          }

          return false
        } catch (error) {
          console.log('error', error)
        }
      },
    }
  },
}).configure({
  HTMLAttributes: {
    class: 'nc-docs-horizontal-rule',
  },
})
