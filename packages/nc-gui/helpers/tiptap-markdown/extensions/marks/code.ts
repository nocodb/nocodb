import type { CodeOptions } from '@tiptap/extension-code'
import type { MarkdownMarkSpec } from '../../types'
import TiptapCode from '@tiptap/extension-code'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'

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
