import TiptapQuote from '@tiptap/extension-blockquote'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { isNodeTypeSelected } from '../helper'

export const Quote = TiptapQuote.extend({
  name: 'quote',
  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-q': () => this.editor.commands.toggleBlockquote(),
      'Enter': () => {
        const editor = this.editor
        const state = editor.state

        if (
          !isNodeTypeSelected({
            state,
            nodeType: TiptapNodesTypes.quote,
          })
        ) {
          return false
        }

        const currentNode = state.selection.$from.node()
        if (!currentNode) return false

        if (currentNode.textContent.length === 0) {
          // Delete empty paragraph
          return editor
            .chain()
            .setTextSelection({ from: state.selection.$from.pos - 1, to: state.selection.$from.pos })
            .deleteSelection()
            .run()
        }

        // Insert empty paragraph/newline
        return editor.chain().insertContentAt(state.selection.$from.pos, { type: TiptapNodesTypes.paragraph, text: '\n' }).run()
      },
    }
  },
})
