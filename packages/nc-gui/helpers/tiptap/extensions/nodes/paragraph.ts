import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { MarkdownNodeSpec } from '../tiptap'

// TODO: Extend from tiptap extension
export const Paragraph = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'paragraph',

  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.paragraph!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
