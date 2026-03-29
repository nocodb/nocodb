import type { MarkdownNodeSpec } from '../../types'
import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'

// TODO: Extend from tiptap extension
export const ListItem = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'listItem',

  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.list_item!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
