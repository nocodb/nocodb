import TiptapCodeBlock from '@tiptap/extension-code-block'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { getPositionOfPreviousSection, isCursorAtStartOfSelectedNode } from '../helper'

export const CodeBlock = TiptapCodeBlock.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-e': () => this.editor.commands.toggleCode(),
      'Backspace': () => {
        const editor = this.editor
        const state = editor.state
        const selection = editor.state.selection

        if (!selection.empty) return false

        if (
          !isNodeTypeSelected({
            state,
            nodeType: TiptapNodesTypes.codeBlock,
          })
        ) {
          return false
        }

        const currentNode = state.selection.$from.node()
        if (!currentNode) return false

        // Select end of previous node if cursor is on start of the code block and codeblock is
        // not empty
        if (currentNode.textContent.length !== 0 && isCursorAtStartOfSelectedNode(state)) {
          const prevSectionNodePos = getPositionOfPreviousSection(state, undefined, 'end')
          if (!prevSectionNodePos) return false

          return editor
            .chain()
            .setTextSelection(prevSectionNodePos - 1)
            .run()
        }

        return false
      },
    }
  },
})
