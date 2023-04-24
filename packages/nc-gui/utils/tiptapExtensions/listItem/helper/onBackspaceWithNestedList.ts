import type { Editor } from '@tiptap/vue-3'
import type { ListNodeType } from '.'

export const onBackspaceWithNestedList = (editor: Editor, nodeType: ListNodeType) => {
  const selection = editor.state.selection
  if (!selection.empty) return false

  let listItemNodePos, listItemNode, currentParagraphNode

  try {
    listItemNodePos = selection.$from.before(selection.$from.depth - 1)
    listItemNode = editor.state.selection.$from.node(-1)
    currentParagraphNode = editor.state.selection.$from.node()
  } catch (e) {
    return false
  }

  if (listItemNode?.type.name !== nodeType) return false

  // Ignore if the list item is on the first level or if the current paragraph is not empty
  if (Number(listItemNode.attrs.level) < 1) return false
  if (currentParagraphNode.textContent.length > 0) return false

  const view = editor.view
  const { tr } = view.state

  // Decrease the level of the list item
  view.dispatch(tr.setNodeAttribute(listItemNodePos, 'level', Number(listItemNode.attrs.level) - 1))

  return true
}
