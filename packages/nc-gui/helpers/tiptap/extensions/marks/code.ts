import TiptapCode, { type CodeOptions } from '@tiptap/extension-code'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { MarkdownMarkSpec } from '../tiptap'

export const Code = TiptapCode.extend<CodeOptions, { markdown: MarkdownMarkSpec }>({
  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.marks.code!,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
