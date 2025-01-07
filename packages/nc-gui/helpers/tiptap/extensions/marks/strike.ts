import TiptapStrike from '@tiptap/extension-strike'
import { markInputRule, markPasteRule } from '@tiptap/core'

export const Strike = TiptapStrike.extend({
  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)(~{1,2})(?!\s+~{1,2})((?:[^~]+))\1(?!\s+~{1,2})$/,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: /(?:^|\s)(~{1,2})(?!\s+~{1,2})((?:[^~]+))\1(?!\s+~{1,2})/g,
        type: this.type,
      }),
    ]
  },
  addStorage() {
    return {
      markdown: {
        serialize: { open: '~', close: '~', mixable: true, expelEnclosingWhitespace: true },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
