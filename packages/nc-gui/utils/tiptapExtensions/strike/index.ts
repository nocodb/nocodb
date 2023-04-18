import TiptapStrike from '@tiptap/extension-strike'

export const Strike = TiptapStrike.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => this.editor.commands.toggleStrike(),
    }
  },
})
