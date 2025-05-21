import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const Blockquote = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'blockquote',

  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.blockquote!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
