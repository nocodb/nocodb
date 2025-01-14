import { Mark } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownMarkSpec } from '../../types'

// TODO: Extend from tiptap extension
export const Bold = Mark.create<any, { markdown: MarkdownMarkSpec }>({
  name: 'bold',
  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.marks.strong!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
