import { Node } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownNodeSpec } from '../../types'
import { mdImageAsText } from '../../../tiptap/functionality'

// TODO: Extend from tiptap extension
export const Image = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'image',
  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.image!,
        parse: {
          setup(markdownit) {
            /**
             * Todo: Remove this once we enable proper image support in the rich text editor.
             * Also, replace its usage in other places such as:
             * 1. packages/nc-gui/helpers/tiptap-markdown/parse/MarkdownParser.ts
             * 2. packages/nc-gui/helpers/tiptap-markdown/extensions/nodes/image.ts
             */
            markdownit.use(mdImageAsText)
          },
        },
      },
    }
  },
})
