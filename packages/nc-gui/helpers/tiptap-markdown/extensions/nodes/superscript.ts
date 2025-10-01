import { mergeAttributes } from '@tiptap/core'
import Superscript from '@tiptap/extension-superscript'

export const NcSuperscript = Superscript.extend({
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0]
  },
})
