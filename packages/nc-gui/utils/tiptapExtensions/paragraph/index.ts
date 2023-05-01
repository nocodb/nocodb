import TiptapParagraph from '@tiptap/extension-paragraph'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { getPositionOfSection } from '../helper'

export const Paragraph = TiptapParagraph.extend({
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const {
          selection: { $head, from },
          doc,
        } = editor.state

        const sectionNode = $head.node($head.depth - 1)
        if (sectionNode?.type.name !== TiptapNodesTypes.sec) return false

        const paragraphNode = $head.node($head.depth)
        if (!paragraphNode.isTextblock) return false

        // Skip if the paragraph is a command
        if (paragraphNode.textContent?.startsWith('/')) return false

        // Split the current paragraph with second half in the newly inserted line
        const currentSectionStartPos = getPositionOfSection(editor.state)
        const currentSectionNode = editor.state.doc.nodeAt(currentSectionStartPos)!

        const currentSectionEndPos = currentSectionStartPos + currentSectionNode?.nodeSize - 1

        const paragraphContent = doc
          .slice(from, currentSectionEndPos)
          ?.toJSON()
          .content.map((node: any) => {
            if (node.content?.length > 0) {
              const childNode = node.content[0]

              if (childNode.type === TiptapNodesTypes.paragraph) return node
            }

            return {
              ...node,
              type: TiptapNodesTypes.paragraph,
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
          currentParagraphNode.type.name === TiptapNodesTypes.paragraph
        ) {
          return editor.chain().focus().deleteActiveSection().run()
        }

        return false
      },
    }
  },
})
