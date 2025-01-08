import TiptapStrike from '@tiptap/extension-strike'

export const Strike = TiptapStrike.extend({
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
