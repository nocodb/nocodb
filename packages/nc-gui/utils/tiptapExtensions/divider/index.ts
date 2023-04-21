import HorizontalTiptapRule from '@tiptap/extension-horizontal-rule'
import { Plugin, PluginKey } from 'prosemirror-state'
import { getPositionOfPreviousSection, getPositionOfSection } from '../helper'

export const Divider = HorizontalTiptapRule.extend({
  name: 'divider',
  addKeyboardShortcuts() {
    return {
      'Ctrl-Shift-H': () => {
        return this.editor.chain().deleteActiveSection().setHorizontalRule().selectActiveSectionFirstChild().run()
      },
      'Enter': () => {
        if (
          !isNodeTypeSelected({
            nodeType: 'divider',
            state: this.editor.state,
          })
        ) {
          return false
        }

        return this.editor.chain().selectNextSection().run()
      },
      'Backspace': () => {
        const state = this.editor.state

        const prevSecPos = getPositionOfPreviousSection(state)
        if (
          prevSecPos &&
          isNodeTypeSelected({
            nodeType: 'divider',
            state,
            sectionPos: prevSecPos,
          })
        ) {
          const currentSectionPos = getPositionOfSection(this.editor.state)
          const prevSectionPos = getPositionOfPreviousSection(this.editor.state)

          return this.editor
            .chain()
            .deleteActiveSection()
            .setNodeSelection(prevSectionPos ?? currentSectionPos)
            .run()
        }

        if (
          !isNodeTypeSelected({
            nodeType: 'divider',
            state,
          })
        ) {
          return false
        }

        return this.editor.chain().deleteActiveSection().selectPrevSection().run()
      },
      'Ctrl-Space': () => {
        return this.editor.chain().deleteActiveSection().setHorizontalRule().selectActiveSectionFirstChild().run()
      },
    }
  },
  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name)
    return [
      new Plugin({
        plugin,
        props: {
          handleClick: (_, pos) => {
            if (
              !isNodeTypeSelected({
                nodeType: 'divider',
                state: this.editor.state,
                sectionPos: pos,
              })
            ) {
              return false
            }

            const sectionPos = getPositionOfSection(this.editor.state, pos)

            return this.editor.chain().setNodeSelection(sectionPos).run()
          },
        },
      }),
    ]
  },
}).configure({
  HTMLAttributes: {
    class: 'nc-docs-divider',
  },
})
