import TiptapQuote from '@tiptap/extension-blockquote'

export const Quote = TiptapQuote.extend({
  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-q': () => this.editor.commands.toggleBlockquote(),
    }
  },
})
