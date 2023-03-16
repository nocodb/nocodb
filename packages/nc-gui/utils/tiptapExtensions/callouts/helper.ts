import type { Editor } from '@tiptap/vue-3'

export const handleOnEnterForCallouts = (editor: Editor) => {
  const state = editor.state

  const { from, to } = editor.state.selection

  if (from !== to) return false

  const parentNode = state.selection.$from.node(-1)
  const currentNode = state.selection.$from.node()

  const parentType = parentNode?.type.name

  if (parentType !== 'infoCallout' && parentType !== 'warningCallout' && parentType !== 'tipCallout') {
    return false
  }

  if (currentNode?.textContent?.length !== 0) {
    editor.chain().insertContentAt(state.selection.$from.pos, { type: 'paragraph', text: '\n' }).run()
    return true
  }

  const node = state.selection.$from.node()

  const nextNodePos = state.selection.$from.pos + node.nodeSize + 1
  const nextNode = state.doc.nodeAt(nextNodePos)

  if (nextNode?.type.name !== 'dBlock') return false

  editor
    .chain()
    .setNodeSelection(from - 1)
    .deleteSelection()
    .focus(nextNodePos)
    .run()

  return true
}

export const handleOnBackspaceForCallouts = (editor: Editor) => {
  const state = editor.state

  const { from, to } = editor.state.selection

  if (from !== to) return false

  const parentNode = state.selection.$from.node(-1)

  const parentType = parentNode?.type.name
  if (parentType !== 'infoCallout' && parentType !== 'warningCallout' && parentType !== 'tipCallout') {
    return false
  }

  // If not the first child of the parent node, and cursor is at the beginning of the node, return true and capture backspace
  if (state.selection.$from.index(-1) === 0 && state.selection.$from.parentOffset === 0) return true

  return false
}
