import { Node } from '@tiptap/core'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const BulletList = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'bulletList',

  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          // Get the previous sibling node
          const previousNode = parent && index > 0 ? parent.child(index - 1) : null

          // Check if the previous node is a different type of list
          const isDifferentListType =
            previousNode && previousNode.type.name !== node.type.name && previousNode.type.name === 'taskList'

          // Add ` <br>\n\n ` if transitioning from a different list type
          if (isDifferentListType) {
            state.write('<br>\n\n ')
          }

          state.renderList(node, '  ', () => `${this.editor.storage.markdown.options.bulletListMarker || '-'} `)
        },

        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
