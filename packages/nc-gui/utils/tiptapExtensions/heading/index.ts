import TiptapHeading from '@tiptap/extension-heading'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { Slice } from 'prosemirror-model'
import { paragraphContent } from '../helper'

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
      Enter: () => {
        const state = this.editor.state
        const {
          selection: { $head, from },
        } = state

        const sectionNode = $head.node($head.depth - 1)
        if (sectionNode?.type.name !== TiptapNodesTypes.sec) return false

        const headerNode = $head.node($head.depth)
        if (headerNode.type.name !== TiptapNodesTypes.heading) return false

        const headerPos = $head.before($head.depth)

        const posEndToBeDeleted = headerPos + headerNode.nodeSize - 1
        const relatedFrom = from - headerPos - 1

        // If cursor is on the begining of the heading, move the heading to the next section
        if (relatedFrom === 0) {
          const nextSectionPos = getPositionOfPreviousSection(this.editor.state) ?? 0
          return this.editor
            .chain()
            .insertContentAt(nextSectionPos, paragraphContent())
            .setTextSelection(from + 3)
            .run()
        }

        // If heading is empty, replace it with a paragraph
        if (headerNode.textContent.length === 0) {
          const sectionPos = getPositionOfSection(this.editor.state)

          const tr = this.editor.state.tr
          tr.setSelection(NodeSelection.create(tr.doc, sectionPos))
          tr.replaceSelection(Slice.fromJSON(state.schema, paragraphContent()))
          tr.setSelection(TextSelection.create(tr.doc, sectionPos + 1))
          this.editor.view.dispatch(tr)

          return true
        }

        // If cursor is at the end of the heading, insert a paragraph after it
        if (relatedFrom === headerNode.textContent.length) {
          return this.editor.chain().insertContentAt(from, paragraphContent()).run()
        }

        // If cursor is inside a header, get the text after the cursor and insert it into a new paragraph
        const textToBeMoved = headerNode.textContent.slice(relatedFrom)
        return this.editor
          .chain()
          .deleteRange({ to: posEndToBeDeleted, from })
          .insertContentAt(from + 1, paragraphContent(textToBeMoved))
          .setTextSelection(from + 2)
          .run()
      },
    }
  },
}).configure({
  HTMLAttributes: {
    'data-tiptap-heading-group': true,
  },
  levels: [1, 2, 3],
})
