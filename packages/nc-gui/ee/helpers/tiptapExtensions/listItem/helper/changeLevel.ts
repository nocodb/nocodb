import type { Editor } from '@tiptap/vue-3'
import type { ListNodeType } from '.'

/**
 * Increase or decrease the level of the list item
 * @param editor
 * @param nodeType
 * @param direction 'forward' or 'backward' to increase or decrease the level
 */
export const changeLevel = (editor: Editor, nodeType: ListNodeType, direction: 'forward' | 'backward') => {
  const state = editor.state
  const selection = state.selection
  const view = editor.view
  const { tr } = view.state

  // If the selection is empty, change the level of the current list item
  if (selection.empty) {
    let currentListItemPos, currentListItemNode
    try {
      currentListItemPos = selection.$from.before(selection.$from.depth - 1)
      currentListItemNode = state.doc.nodeAt(currentListItemPos)
    } catch (e) {
      return false
    }

    if (currentListItemNode?.type.name !== nodeType) return false

    const level = Number(currentListItemNode.attrs.level)
    view.dispatch(tr.setNodeAttribute(currentListItemPos, 'level', newLevel(level, direction)))

    return true
  } else {
    // If the selection is not empty, change the level of the list items in the selection
    const state = editor.state
    const tr = state.tr
    const view = editor.view

    const currentSectionPos = getPositionOfSection(state)
    const nextSectionPos = getPositionOfNextSection(state, selection.to) ?? state.doc.nodeSize - 2

    let found = false
    // traverse through the slice and change the level of the list items
    state.doc.descendants((node, pos) => {
      if (pos >= currentSectionPos && pos < nextSectionPos) {
        if (node.type.name === nodeType) {
          found = true

          const level = Number(node.attrs.level)
          tr.setNodeAttribute(pos, 'level', newLevel(level, direction))

          return false
        }
      }

      return true
    })

    if (!found) return false

    view.dispatch(tr)

    return true
  }
}

function newLevel(currentLevel: number, direction: 'forward' | 'backward') {
  let newLevel = currentLevel + (direction === 'forward' ? 1 : -1)
  newLevel = newLevel < 0 ? 0 : newLevel

  return newLevel
}
