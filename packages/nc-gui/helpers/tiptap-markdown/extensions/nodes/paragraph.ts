import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import TiptapParagraph, { type ParagraphOptions } from '@tiptap/extension-paragraph'
import type { MarkdownNodeSpec } from '../../types'

export const Paragraph = TiptapParagraph.extend<ParagraphOptions, { markdown: MarkdownNodeSpec }>({
  addKeyboardShortcuts() {
    return {
      ...(this.parent?.() ?? {}),
      Enter: () => {
        const { state, view } = this.editor

        // Remove all stored marks for the next typed text
        const tr = state.tr
        Object.values(state.schema.marks).forEach((markType) => {
          tr.removeStoredMark(markType)
        })

        view.dispatch(tr)

        return false // return false to avoid preventing the default Enter behavior
      },
    }
  },
  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          // Check if the paragraph is empty
          const isEmpty = node.childCount === 0

          // Check if it's the last block in the document
          const isLastNode = parent && parent.child(parent.childCount - 1) === node

          if (isEmpty && !isLastNode) {
            state.write(' <br>\n\n ')
            return
          }

          defaultMarkdownSerializer.nodes.paragraph?.(state, node, parent, index)
        },

        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
