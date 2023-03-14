import type { EditorState, Transaction } from 'prosemirror-state'
import type { Fragment } from 'prosemirror-model'
import type { Editor } from '@tiptap/core'

export const addPastedContentToTransaction = (transaction: Transaction, state: EditorState, fragments: Fragment[]) => {
  const { selection } = state

  const currentNodeIsEmpty = selection.$from.parent.textContent === ''

  for (const fragment of fragments) {
    transaction.insert(currentNodeIsEmpty ? selection.from - 1 : selection.from, fragment)
  }
}

export const getTextFromSliceJson = (sliceJson: any) => {
  // recursively get text from slice json
  const getText = (sliceJson: any, text: string) => {
    if (sliceJson.text) {
      text = text + sliceJson.text
    }

    if (sliceJson.content) {
      for (const content of sliceJson.content) {
        text = text + getText(content, text)
      }
    }

    return text
  }

  return getText(sliceJson, '')
}

export const getTextAsParagraphFromSliceJson = (sliceJson: any) => {
  const text = getTextFromSliceJson(sliceJson)

  if (text.length === 0) {
    return {
      type: 'paragraph',
      content: [],
    }
  }

  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: getTextFromSliceJson(sliceJson),
      },
    ],
  }
}

export const isSelectionOfType = (state: EditorState, type: string) => {
  try {
    const { selection } = state

    const topDBlockPos = selection.$from.before(1)

    const bottomDBlockPos = selection.$to.after(1)

    const slice = state.doc.slice(topDBlockPos, bottomDBlockPos)
    const sliceJson = slice.toJSON()

    let count = 0
    for (const node of sliceJson.content) {
      count = count + 1
      if (node.type !== 'dBlock') {
        return false
      }

      for (const child of node.content) {
        if (child.type === type) {
          continue
        }

        if (count === sliceJson.content.length && child.type === 'paragraph' && !child.content) {
          // Last node is paragraph and it's empty
          return true
        }

        return false
      }
    }

    return true
  } catch (error) {
    return false
  }
}

export const onEnter = (editor: Editor, nodeType: 'bullet' | 'ordered' | 'task') => {
  const { selection } = editor.state

  const parentNode = selection.$from.node(-1)
  if (parentNode.type.name !== nodeType) return false
  const currentNode = selection.$from.node()

  // Delete the bullet point if it's empty
  const currentNodeIsEmpty = currentNode.textContent.length === 0
  if (currentNodeIsEmpty) {
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

    return true
  }

  const isMultiSelect = selection.from !== selection.to
  const currentNodePosResolve = editor.state.doc.resolve(selection.from)

  const from = selection.from
  const currentNodeEndPos = currentNodePosResolve.posAtIndex(1)

  // We check if cursor at the end of the bullet point
  const isOnEndOfLine = currentNodeEndPos === selection.to

  const sliceToBeMoved = editor.state.doc.slice(from, currentNodeEndPos)

  const sliceToBeMovedContent = !isOnEndOfLine ? sliceToBeMoved.toJSON().content : []

  editor
    .chain()
    .insertContentAt(currentNodeEndPos + 2, {
      type: 'dBlock',
      content: [
        {
          type: nodeType,
          attrs: {
            number: nodeType === 'ordered' ? String(Number(parentNode.attrs.number) + 1) : undefined,
            checked: nodeType === 'task' ? false : undefined,
          },
          content: [
            {
              type: 'paragraph',
              content: isMultiSelect ? [] : sliceToBeMovedContent,
            },
          ],
        },
      ],
    })
    .setTextSelection(currentNodeEndPos + 1)
    .deleteRange({ from, to: currentNodeEndPos })
    .run()

  if (isOnEndOfLine) {
    const pos = currentNodeEndPos + 6
    editor.chain().focus().setTextSelection(pos).run()
  }
  return true
}
