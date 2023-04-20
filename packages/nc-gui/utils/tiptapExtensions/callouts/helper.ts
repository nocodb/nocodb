import type { Editor } from '@tiptap/vue-3'

export const handleOnEnterForCallouts = (editor: Editor) => {
  // Extract the state and selection objects from the editor
  const state = editor.state
  const selection = editor.state.selection

  // Extract the start and end positions of the current selection
  const { from, to } = editor.state.selection

  // If there is a selection, return false
  if (from !== to) return false

  // Get the parent node and the current node of the selection
  const parentNode = state.selection.$from.node(-1)
  const currentNode = state.selection.$from.node()

  // Get the type of the parent node and return false if it's not one of infoCallout, warningCallout, or tipCallout
  const parentType = parentNode?.type.name
  if (parentType !== 'infoCallout' && parentType !== 'warningCallout' && parentType !== 'tipCallout') {
    return false
  }

  // Check if the current node is the last child of the parent node and if its text content is empty
  const isLastChild = parentNode.childCount === state.selection.$from.index(state.selection.$from.depth - 1) + 1
  if (!isLastChild || currentNode.textContent.length !== 0) {
    // If the current node is not the last child or its text content is not empty, insert a new paragraph after the current node and return true
    const parentOffset = selection.$from.parentOffset
    if (parentOffset !== currentNode.textContent.length) return false

    let toBeInsertedPos = state.selection.$from.pos
    if (currentNode.textContent.length === 0) {
      toBeInsertedPos = toBeInsertedPos + 1
    }

    editor.chain().insertContentAt(toBeInsertedPos, { type: 'paragraph', text: '\n' }).run()
    return true
  }

  // If the current node is the last child and its text content is empty, check if the next node is of type 'sec'
  const node = state.selection.$from.node()
  const nextNodePos = state.selection.$from.pos + node.nodeSize + 1
  const nextNode = state.doc.nodeAt(nextNodePos)

  if (nextNode?.type.name !== 'sec') return false

  // Delete the current node and move the cursor to the start of the next node
  editor
    .chain()
    // Handle the case of enter on empty callout node
    .setNodeSelection(parentNode.childCount === 1 && currentNode?.textContent?.length === 0 ? from - 2 : from - 1)
    .deleteSelection()
    .focus(nextNodePos)
    .run()

  return true
}
