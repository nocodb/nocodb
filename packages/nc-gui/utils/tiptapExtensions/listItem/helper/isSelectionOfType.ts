import type { EditorState } from 'prosemirror-state'
import type { ListNodeType } from '.'

export const isSelectionOfType = (state: EditorState, type: ListNodeType) => {
  const selection = state.selection
  const currentSectionNode = getPositionOfSection(state)
  const nextSectionNode = getPositionOfNextSection(state, selection.to) ?? state.doc.nodeSize - 2

  const slice = state.doc.slice(currentSectionNode, nextSectionNode)
  const sliceJson = slice.toJSON()

  // Iterate through all the nodes in the slice
  // And check if all the nodes are of the given type
  let count = 0
  for (const node of sliceJson.content) {
    count = count + 1
    if (node.type !== 'sec') return false

    for (const child of node.content) {
      if (child.type === type) continue

      if (count === sliceJson.content.length && child.type === 'paragraph' && !child.content) {
        // Last node is paragraph and it's empty
        // We do as even if the empty paragraph is selected at the end of the selection
        // The para selection is not visible to the user
        return true
      }

      return false
    }
  }

  return true
}
