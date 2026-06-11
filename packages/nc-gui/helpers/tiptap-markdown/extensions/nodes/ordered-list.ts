import { Node } from '@tiptap/core'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const OrderedList = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'orderedList',

  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          const start = node.attrs.start || 1
          const maxW = String(start + node.childCount - 1).length
          const space = state.repeat(' ', maxW + 2)
          const adjacentIndex = findIndexOfAdjacentNode(node, parent, index)
          const separator = adjacentIndex % 2 ? ') ' : '. '
          state.renderList(node, space, (i) => {
            const nStr = String(start + i)
            return state.repeat(' ', maxW - nStr.length) + nStr + separator
          })
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})

function findIndexOfAdjacentNode(node, parent, index) {
  let i = 0
  for (; index - i > 0; i++) {
    if (parent.child(index - i - 1).type.name !== node.type.name) {
      break
    }
  }
  return i
}
