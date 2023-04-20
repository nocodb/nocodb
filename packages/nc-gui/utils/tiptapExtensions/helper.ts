import type { EditorState } from 'prosemirror-state'
import { getPositionOfNextSection, getPositionOfSection } from './section/helpers'

export const isNodeTypeSelected = ({
  state,
  nodeType,
  sectionPos,
}: {
  state: EditorState
  nodeType: string
  sectionPos?: number
}) => {
  const { $to } = state.selection

  const selectedSectionPos = sectionPos ?? getPositionOfSection(state)

  let found = false
  state.doc.nodesBetween(selectedSectionPos, $to.pos, (node) => {
    if (node.type.name === nodeType) found = true
    return true
  })
  return found
}

export const getPosOfNodeTypeInSection = ({
  state,
  nodeType,
  sectionPos,
}: {
  state: EditorState
  nodeType: string
  sectionPos?: number
}) => {
  const { $to } = state.selection

  const selectedSectionPos = sectionPos ?? getPositionOfSection(state)

  let giveTypePos: null | number = null
  state.doc.nodesBetween(selectedSectionPos, $to.pos + 1, (node, pos) => {
    if (node.type.name === nodeType) {
      giveTypePos = pos
      return false
    }

    return true
  })
  return giveTypePos
}

export const getPosOfChildNodeOfType = ({
  state,
  nodeType,
  nodePos,
  childIndex = 0,
}: {
  state: EditorState
  nodeType: string
  nodePos?: number
  childIndex?: number
}) => {
  const { $from } = state.selection

  const anchorPos = nodePos ?? $from.pos
  let nextSectionPos = getPositionOfNextSection(state, anchorPos + 1)
  // If there is no next section, then the next section position will be the end of the document
  nextSectionPos = nextSectionPos ?? state.doc.nodeSize

  let giveTypePos = null
  let iterChildIndex = 0

  state.doc.nodesBetween(anchorPos, nextSectionPos, (node, pos) => {
    if (node.type.name === nodeType) {
      if (iterChildIndex === childIndex) {
        giveTypePos = pos
      }
      iterChildIndex = iterChildIndex + 1
      return false
    }

    return true
  })
  return giveTypePos
}

export const positionOfFirstChild = (state: EditorState, parentPos: number, posType: 'start' | 'end' | undefined = 'end') => {
  const node = state.doc.nodeAt(parentPos)
  if (!node) return undefined

  const firstChild = node.firstChild
  if (!firstChild) return undefined

  // TODO: Find a better way to find position of first child start.
  // Main issue is to find pos when there is transformation happening
  if (posType === 'start') {
    return parentPos + 2
  }

  return parentPos + firstChild.nodeSize
}

export const isLastChild = (state: EditorState, pos: number) => {
  const posResolve = state.doc.resolve(pos)
  // As section node will have only one child, so the given position will be the last child
  if (posResolve.depth - 1 === 0) return true

  const parentPos = posResolve.before(posResolve.depth - 1)
  const parent = state.doc.nodeAt(parentPos)

  return posResolve.index(posResolve.depth - 1) === parent!.childCount - 1
}

/**
 * Verify that the cursor is at the beginning of the active paragraph node
 * @param state
 */
export const isCursorAtStartOfParagraph = (state: EditorState) => {
  const pos = state.selection.$from.pos
  const resolve = state.doc.resolve(pos)

  const node = state.selection.$from.node()
  if (!node || node.type.name !== 'paragraph') return false

  const offset = resolve.parentOffset

  return offset === 0
}
