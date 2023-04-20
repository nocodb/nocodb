import type { EditorState } from 'prosemirror-state'
import { getPositionOfSection } from './section/helpers'

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
  const nextSectionPos = getPositionOfSection(state, anchorPos + 1)

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

export const positionOfFirstChild = (state: EditorState, pos: number) => {
  const node = state.doc.nodeAt(pos)
  if (!node) return undefined

  const firstChild = node.firstChild
  if (!firstChild) return undefined

  return pos + firstChild.nodeSize
}

export const isLastChild = (state: EditorState, pos: number) => {
  const posResolve = state.doc.resolve(pos)
  // As section node will have only one child, so the given position will be the last child
  if (posResolve.depth - 1 === 0) return true

  const parentPos = posResolve.before(posResolve.depth - 1)
  const parent = state.doc.nodeAt(parentPos)

  return posResolve.index(posResolve.depth - 1) === parent!.childCount - 1
}
