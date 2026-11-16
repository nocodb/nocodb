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
          // Inside a list or quote, ` <br>` reloads as a lone hard break, which serializes to nothing
          let isEmpty = true
          node.forEach((child) => {
            if (child.type.name !== 'hardBreak') isEmpty = false
          })

          // Check if it's the last block in the document
          const isLastNode = parent && parent.child(parent.childCount - 1) === node

          if (isEmpty && !isLastNode) {
            state.write(' <br>')
            // closeBlock, not a raw "\n\n ": a leading space before the next block
            // indents a code fence, and CommonMark strips it from every code line.
            state.closeBlock(node)
            // A tight list would close with one newline, gluing a following nested list to the <br>
            state.flushClose(2)
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
