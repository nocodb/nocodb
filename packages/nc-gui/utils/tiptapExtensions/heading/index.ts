import TiptapHeading from '@tiptap/extension-heading'

export const Heading = TiptapHeading.extend({
  addKeyboardShortcuts() {
    return this.options.levels.reduce(
      (items, level) => ({
        ...items,
        ...{
          [`Ctrl-Shift-${level}`]: () => this.editor.commands.toggleHeading({ level }),
        },
      }),
      {},
    )
  },
}).configure({
  HTMLAttributes: {
    'data-tiptap-heading': true,
  },
  levels: [1, 2, 3],
})
