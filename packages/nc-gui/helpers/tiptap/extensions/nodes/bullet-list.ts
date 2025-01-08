import { Node } from '@tiptap/core'
import type { MarkdownNodeSpec } from '../tiptap'

// TODO: Extend from tiptap extension
export const BulletList = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'bulletList',

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          return state.renderList(node, '  ', () => (this.editor.storage.markdown.options.bulletListMarker || '-') + ' ')
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
