import { Node } from '@tiptap/core'
import { escapeHTML } from '../../util/dom'
import type { MarkdownNodeSpec } from '../../index'

// TODO: Extend from tiptap extension
export const Text = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'text',

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          state.text(escapeHTML(node.text))
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
