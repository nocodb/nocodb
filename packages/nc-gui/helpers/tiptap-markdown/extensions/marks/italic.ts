import TiptapItalic, { type ItalicOptions } from '@tiptap/extension-italic'
import type { MarkdownMarkSpec } from '../../types'

export const Italic = TiptapItalic.extend<ItalicOptions, { markdown: MarkdownMarkSpec }>({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '_', close: '_', mixable: true, expelEnclosingWhitespace: true },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
