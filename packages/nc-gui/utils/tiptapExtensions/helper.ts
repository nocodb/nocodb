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

export const positionOfFirstChild = (state: EditorState, pos: number) => {
  const node = state.doc.nodeAt(pos)
  if (!node) return undefined

  const firstChild = node.firstChild
  if (!firstChild) return undefined

  return pos + firstChild.nodeSize
}
