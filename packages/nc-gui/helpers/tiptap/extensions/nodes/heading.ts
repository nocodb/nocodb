import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { MarkdownNodeSpec } from '../tiptap'

// TODO: Extend from tiptap extension
export const Heading = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'heading',

  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.heading!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
