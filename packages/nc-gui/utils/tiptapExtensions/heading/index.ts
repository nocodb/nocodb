import TiptapHeading from '@tiptap/extension-heading'
import { TiptapNodesTypes } from 'nocodb-sdk'

export const Heading = TiptapHeading.extend({
  addKeyboardShortcuts() {
    const toggleShotcuts = this.options.levels.reduce(
      (items, level) => ({
        ...items,
        ...{
          [`Ctrl-Shift-${level}`]: () => this.editor.commands.toggleHeading({ level }),
        },
      }),
      {},
    )
    return {
      ...toggleShotcuts,
      // Backspace on empty heading will toggle it to a paragraph
      Backspace: () => {
        const { selection } = this.editor.state
        const node = selection.$from.node()
        if (node.type.name !== TiptapNodesTypes.heading) return false
        if (node.textContent !== '') return false

        return this.editor.chain().setNode(TiptapNodesTypes.paragraph).run()
      },
    }
  },
}).configure({
  HTMLAttributes: {
    'data-tiptap-heading': true,
  },
  levels: [1, 2, 3],
})
