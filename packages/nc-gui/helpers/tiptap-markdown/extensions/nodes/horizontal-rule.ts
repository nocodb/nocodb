import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const HorizontalRule = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'horizontalRule',

  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.horizontal_rule!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
