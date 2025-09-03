import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer, defaultMarkdownParser } from '@tiptap/pm/markdown'
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
