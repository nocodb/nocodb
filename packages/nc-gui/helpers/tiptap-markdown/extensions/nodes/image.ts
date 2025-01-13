import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownNodeSpec } from '../../index'

// TODO: Extend from tiptap extension
export const Image = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'image',
  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.image!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
