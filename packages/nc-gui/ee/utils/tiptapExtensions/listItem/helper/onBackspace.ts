import type { Editor } from '@tiptap/vue-3'
import { TextSelection } from 'prosemirror-state'
import { TiptapNodesTypes } from 'nocodb-sdk'
import type { ListNodeType } from '.'

export const onBackspace = (editor: Editor, nodeType: ListNodeType) => {
  const state = editor.state
  const selection = state.selection
  let listItemNodePos, listItemNode, currentParagraphNode

  try {
    listItemNodePos = selection.$from.before(selection.$from.depth - 1)
    listItemNode = editor.state.selection.$from.node(-1)
    currentParagraphNode = editor.state.selection.$from.node()
  } catch (e) {
    return false
  }

  if (listItemNode?.type.name !== nodeType) return false

  if (handleNonEmptySelection(editor, listItemNodePos)) return true

  if (!selection.empty) return false

  if (currentParagraphNode.textContent.length > 0) return false

  const view = editor.view
  const { tr } = view.state

  // If the list item is not nested and empty, convert it to a paragraph
  if (Number(listItemNode.attrs.level) < 1) {
    const paragraphNode = editor.state.schema.nodes.paragraph.createAndFill()
    if (!paragraphNode) return false

    tr.replaceRangeWith(listItemNodePos, listItemNodePos + listItemNode.nodeSize, paragraphNode)
    tr.setSelection(TextSelection.create(tr.doc, listItemNodePos + 1))
    view.dispatch(tr)
    return true
  }

  // Decrease the level of the list item
  view.dispatch(tr.setNodeAttribute(listItemNodePos, 'level', Number(listItemNode.attrs.level) - 1))

  return true
}

/** Handle the case where the entire cell is text selected and contains list items on the start of the cell
 * If we dont do this the next cell will be merged with the current cell (some weird prosemirror tables behavior)
 *  Here we just replace the selection with a paragraph
 * Keeping try catch as this can throw error in other cases
 */
function handleNonEmptySelection(editor: Editor, listItemNodePos: number) {
  const state = editor.state
  const { selection } = state
  try {
    const parentNode = state.doc.nodeAt(listItemNodePos - 1)
    let nextParentNode = state.doc.nodeAt(selection.to + 2)
    // Incase of last item being list item offset will be 3 and for paragraph it will be 2
    nextParentNode =
      nextParentNode?.type.name === TiptapNodesTypes.tableCell ? nextParentNode : state.doc.nodeAt(selection.to + 3)

    if (
      !selection.empty &&
      selection instanceof TextSelection &&
      parentNode?.type.name === TiptapNodesTypes.tableCell &&
      nextParentNode?.type.name === TiptapNodesTypes.tableCell
    ) {
      const tr = state.tr
      const para = editor.state.schema.nodes.paragraph.createAndFill()
      if (!para) return false

      tr.replaceSelectionWith(para)
      tr.setSelection(TextSelection.create(tr.doc, selection.from - 2))
      editor.view.dispatch(tr)

      return true
    }
  } catch {}
}
