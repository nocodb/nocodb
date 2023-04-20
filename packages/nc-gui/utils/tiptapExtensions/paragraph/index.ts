import TiptapParagraph from '@tiptap/extension-paragraph'
import { getPositionOfNextSection } from '../section/helpers'

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

        const startOfNewParagraphNode = from + 4

        return editor
          .chain()
          .insertContentAt({ from, to: currentSectionEndPos }, paragraphContent)
          .focus(startOfNewParagraphNode)
          .run()
      },
    }
  },
})
