import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const Paragraph = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'paragraph',

  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          // Check if the paragraph is empty
          const isEmpty = node.childCount === 0

          // Check if it's the last block in the document
          const isLastNode = parent && parent.child(parent.childCount - 1) === node

          // Handle empty paragraphs
          if (isEmpty && !isLastNode) {
            // Add `<br>` with a newline if the next node is a block
            const nextNode = parent.child(parent.children.indexOf(node) + 1)

            if (nextNode?.isBlock && !['hardBreak', 'paragraph'].includes(nextNode.type.name)) {
              state.write(' <br>\n\n ') // Ensure block starts correctly
            } else {
              state.write(' <br> ') // Inline <br>` for non-block contexts
            }
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
