import TiptapItalic from '@tiptap/extension-italic'

export const Italic = TiptapItalic.extend({
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
