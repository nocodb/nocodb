import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { MarkdownNodeSpec } from '../tiptap'

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
