import type { Editor } from '@tiptap/vue-3'
import type { ListNodeType } from '.'

export const onEnter = (editor: Editor, nodeType: ListNodeType) => {
  const { selection } = editor.state

  if (!selection.empty) return false

  const currentListNode = selection.$from.node(-1)
  if (currentListNode?.type.name !== nodeType) return false

  const currentParagraph = selection.$from.node()
  const currentSectionNode = selection.$from.node(-2)

  // Delete the list node if it's empty
  const currentNodeIsEmpty = currentParagraph.textContent.trim().length === 0

  // Do not handle if section is not the parent of the list and the list node is empty
  if (currentNodeIsEmpty && currentSectionNode.type.name !== 'sec') return false

  // Decrease the level of the list node if it's empty on enter
  const level = Number(currentListNode.attrs.level)
  if (currentNodeIsEmpty && level > 0) {
    const newLevel = level - 1
    const parentNodePos = selection.$from.before(selection.$from.depth - 1)

    editor.view.dispatch(editor.view.state.tr.setNodeAttribute(parentNodePos, 'level', Number(newLevel)))

    return true
  }

  // Toggle list node to paragraph if it's empty and the level is 0
  if (currentNodeIsEmpty) {
    toggleListNode(editor, nodeType)

    return true
  }

  const currentParaNodePosResolve = editor.state.doc.resolve(selection.from)
  const currentParaNodeEndPos = currentParaNodePosResolve.posAtIndex(currentParagraph.childCount)

  // We check if cursor at the end of the bullet point
  const isOnEndOfLine = currentParaNodeEndPos === selection.to

  const sliceToBeMoved = editor.state.doc.slice(selection.from, currentParaNodeEndPos)
  // On end of the line toJSON().content is incorrect schema wise
  const sliceToBeMovedContent = !isOnEndOfLine ? sliceToBeMoved.toJSON().content : []

  const newSecContent = {
    type: 'sec',
    content: [
      {
        type: nodeType,
        attrs: {
          number: nodeType === 'ordered' ? String(Number(currentListNode.attrs.number) + 1) : undefined,
          checked: nodeType === 'task' ? false : undefined,
          level,
        },
        content: [
          {
            type: 'paragraph',
            content: sliceToBeMovedContent,
          },
        ],
      },
    ],
  }

  // Insert new list node after the current list node and delete the things after the cursor in the current list node
  editor
    .chain()
    .insertContentAt(
      currentParaNodeEndPos + 2,
      currentSectionNode.type.name === 'sec'
        ? newSecContent
        : {
            type: nodeType,
            attrs: {
              number: nodeType === 'ordered' ? String(Number(currentListNode.attrs.number) + 1) : undefined,
              checked: nodeType === 'task' ? false : undefined,
              level,
            },
            content: [
              {
                type: 'paragraph',
                content: sliceToBeMovedContent,
              },
            ],
          },
    )
    .setTextSelection(currentParaNodeEndPos + 1)
    .deleteRange({ from: selection.from, to: currentParaNodeEndPos })
    .run()

  if (isOnEndOfLine && currentSectionNode.type.name !== 'sec') {
    return false
  }

  if (isOnEndOfLine) {
    // TODO: Remove hard coding
    const pos = currentParaNodeEndPos + 6
    editor.chain().focus().setTextSelection(pos).run()
  }

  return true
}

function toggleListNode(editor: Editor, nodeType: ListNodeType) {
  const selection = editor.state.selection

  editor
    .chain()
    .command(({ chain }) => {
      if (nodeType === 'task') {
        chain().toggleTask()
      } else if (nodeType === 'ordered') {
        chain().toggleOrdered()
      } else {
        chain().toggleBullet()
      }

      return true
    })
    .setTextSelection(selection.from - 1)
    .run()
}
