import type { Editor } from '@tiptap/vue-3'
import { getPosOfNodeTypeInSection, isLastChild, isNodeTypeSelected, positionOfFirstChild } from '../helper'
import { getPositionOfNextSection } from '../section/helpers'

export const handleOnEnterForCallouts = (editor: Editor, type: 'infoCallout' | 'tipCallout' | 'warningCallout') => {
  const state = editor.state
  const selection = state.selection

  if (
    !isNodeTypeSelected({
      nodeType: type,
      state: editor.state,
    })
  ) {
    return false
  }

  const calloutPos = getPosOfNodeTypeInSection({
    nodeType: type,
    state: editor.state,
  })
  if (!calloutPos) return false

  const calloutNode = state.doc.nodeAt(calloutPos)
  if (!calloutNode) return false

  const currentParagraph = selection.$from.node()
  const currentParagraphPos = selection.$from.pos

  if (isLastChild(state, currentParagraphPos) && currentParagraph.textContent.length === 0) {
    const nextSectionPos = getPositionOfNextSection(state)
    if (!nextSectionPos) return false

    const posOfFirstChildOfNextSection = positionOfFirstChild(state, nextSectionPos)
    if (!posOfFirstChildOfNextSection) return false

    editor
      .chain()
      // Select the paragraph node, which will one position before the selected text node
      .setNodeSelection(selection.from - 1)
      .deleteSelection()
      .focus(posOfFirstChildOfNextSection)
      .run()
  }

  const parentOffset = state.selection.$from.parentOffset
  if (parentOffset !== currentParagraph.textContent.length) return false

  let toBeInsertedPos = state.selection.$from.pos
  if (currentParagraph.textContent.length === 0) {
    toBeInsertedPos = toBeInsertedPos + 1
  }

  return editor.chain().insertContentAt(toBeInsertedPos, { type: 'paragraph', text: '\n' }).run()
}
