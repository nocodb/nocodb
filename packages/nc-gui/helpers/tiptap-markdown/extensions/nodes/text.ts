import { Node } from '@tiptap/core'
import { escapeHTML } from '../../util/dom'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const Text = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'text',

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          // Leading spaces are encoded in MarkdownSerializerState.text; WorkflowInput stores this output unescaped
          state.text(escapeHTML(node.text, !!state.options.preserveLeadingSpaces))
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
