import { Node } from '@tiptap/core'
import { escapeHTML } from '../../util/dom'
import type { MarkdownNodeSpec } from '../tiptap'

// TODO: Extend from tiptap extension
const Text = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'text',
})

export default Text.extend({
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
