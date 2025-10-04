import { mergeAttributes } from '@tiptap/core'
import Subscript from '@tiptap/extension-subscript'

export const NcSubscript = Subscript.extend({
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0]
  },
})
