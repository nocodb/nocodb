import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownNodeSpec } from '../../types'

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
