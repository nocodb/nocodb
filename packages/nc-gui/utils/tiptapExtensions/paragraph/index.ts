import TiptapParagraph from '@tiptap/extension-paragraph'
import { getPositionOfNextSection } from '../helper'

export const Paragraph = TiptapParagraph.extend({
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const {
          selection: { $head, from },
          doc,
        } = editor.state

        const sectionNode = $head.node($head.depth - 1)
        if (sectionNode?.type.name !== 'sec') return false

        const paragraphNode = $head.node($head.depth)
        if (paragraphNode.type.name !== 'paragraph') return false

        // Skip if the paragraph is a command
        if (paragraphNode.textContent?.startsWith('/')) return false

        const nextSectionPos = getPositionOfNextSection(editor.state)
        const currentSectionEndPos = nextSectionPos ? nextSectionPos - 1 : doc.nodeSize - 2

        const paragraphContent = doc
          .slice(from, currentSectionEndPos)
          ?.toJSON()
          .content.map((node: any) => {
            if (node.content?.length > 0) {
              const childNode = node.content[0]

              if (childNode.type === 'paragraph') return node
            }

            return {
              ...node,
              type: 'paragraph',
            }
          })

        return editor
          .chain()
          .insertContentAt({ from, to: currentSectionEndPos }, paragraphContent)
          .selectActiveSectionFirstChild()
          .run()
      },
      Backspace: ({ editor }) => {
        const state = editor.state
        const selection = state.selection

        // Handle delete on first empty line
        const currentParagraphNode = selection.$from.node()
        const firstLinePos = 2

        if (
          selection.empty &&
          selection.from === firstLinePos &&
          currentParagraphNode.textContent === '' &&
          currentParagraphNode.type.name === 'paragraph'
        ) {
          return editor.chain().focus().deleteActiveSection().run()
        }

        return false
      },
    }
  },
})
