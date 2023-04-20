import type { EditorState } from 'prosemirror-state'

const nodeTypesContainingSection = ['sec', 'collapsible', 'collapsible_header', 'collapsible_content']

/**
 * Gets position of section node which contains the cursor or the given position which is inside the section
 */
export const getPositionOfSection = (state: EditorState, pos?: number) => {
  const searchStopPos = pos ?? state.selection.$from.pos
  let sectionPos = 0
  state.doc.descendants((node, _pos) => {
    if (node.type.name === 'sec' && _pos < searchStopPos) {
      sectionPos = _pos
    }

    if (nodeTypesContainingSection.includes(node.type.name)) {
      return true
    }

    return false
  })

  return sectionPos
}

/**
 * Gets position of previous section node which contains the cursor or the given position which is inside the section
 * Returns null if there is no next section
 * @param state
 * @param pos - optional
 **/
export const getPositionOfPreviousSection = (state: EditorState, pos?: number) => {
  const searchStopPos = pos ?? state.selection.$from.pos

  const givenSectionPos = getPositionOfSection(state, searchStopPos)
  const prevSectionPos = getPositionOfSection(state, givenSectionPos - 1)

  if (prevSectionPos === givenSectionPos) return null

  return prevSectionPos
}

/**
 * Gets position of next section node which contains the cursor or the given position which is inside the section
 * Returns null if there is no next section
 * @param state
 * @param pos - optional
 **/

export const getPositionOfNextSection = (state: EditorState, pos?: number) => {
  const searchStopPos = pos ?? state.selection.$from.pos

  const givenSectionPos = getPositionOfSection(state, searchStopPos)
  const givenSectionNode = state.doc.nodeAt(givenSectionPos)
  const nextSectionPos = getPositionOfSection(state, givenSectionPos + givenSectionNode!.nodeSize + 1)

  if (nextSectionPos === givenSectionPos) return null

  return nextSectionPos
}

export const isSectionEmptyParagraph = (state: EditorState, pos?: number) => {
  let sectionPos = pos ?? state.selection.$from.pos
  const _sectionNode = state.doc.nodeAt(sectionPos)
  if (!_sectionNode || _sectionNode.type.name !== 'sec') {
    sectionPos = getPositionOfSection(state, pos)
  }

  const sectionNode = state.doc.nodeAt(sectionPos)
  const sectionFirstChild = sectionNode?.firstChild
  if (!sectionFirstChild) return false

  return sectionFirstChild.type.name === 'paragraph' && sectionFirstChild.textContent.length === 0
}
