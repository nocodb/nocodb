import type { EditorState, Transaction } from 'prosemirror-state'
import type { Fragment } from 'prosemirror-model'
import { PasteRule } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { toggleItem } from './helper/toggleItem'

export const addPastedContentToTransaction = (transaction: Transaction, state: EditorState, fragments: Fragment[]) => {
  const { selection } = state

  const currentNodeIsEmpty = selection.$from.parent.textContent === ''

  for (const fragment of fragments) {
    transaction.insert(currentNodeIsEmpty ? selection.from - 1 : selection.from, fragment)
  }
}

export const isSelectionOfType = (state: EditorState, type: string) => {
  try {
    const selection = state.selection
    const selectionSlice = state.doc.slice(selection.from - 2, selection.to)
    const selectionSliceJson = selectionSlice.toJSON()

    const isSelectionInOneDBlock = (selectionSliceJson.content as any[]).some((node) => node.type === 'dBlock')

    const activeInDBlocks = () => {
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
    }

    const activeInListItems = () => {
      for (const child of selectionSliceJson.content) {
        if (child.type === type) {
          continue
        }

        return false
      }

      return true
    }

    return isSelectionInOneDBlock ? activeInDBlocks() : activeInListItems()
  } catch (error) {
    return false
  }
}

export const onEnter = (editor: Editor, nodeType: 'bullet' | 'ordered' | 'task') => {
  const { selection } = editor.state

  const parentNode = selection.$from.node(-1)
  if (parentNode?.type.name !== nodeType) return false
  const currentNode = selection.$from.node()
  const parentParentNode = selection.$from.node(-2)

  // Delete the bullet point if it's empty
  const currentNodeIsEmpty = currentNode.textContent.trim().length === 0

  if (currentNodeIsEmpty && parentParentNode.type.name !== 'dBlock') {
    return false
  }

  const level = Number(parentNode.attrs.level)
  if (currentNodeIsEmpty && level > 0) {
    const newLevel = level - 1
    const parentNodePos = selection.$from.before(selection.$from.depth - 1)

    editor.view.dispatch(editor.view.state.tr.setNodeAttribute(parentNodePos, 'level', Number(newLevel)))

    return true
  }

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
  const currentNodeEndPos = currentNodePosResolve.posAtIndex(currentNode.childCount)

  // We check if cursor at the end of the bullet point
  const isOnEndOfLine = currentNodeEndPos === selection.to

  const sliceToBeMoved = editor.state.doc.slice(from, currentNodeEndPos)

  const sliceToBeMovedContent = !isOnEndOfLine ? sliceToBeMoved.toJSON().content : []

  const newDblockContent = {
    type: 'dBlock',
    content: [
      {
        type: nodeType,
        attrs: {
          number: nodeType === 'ordered' ? String(Number(parentNode.attrs.number) + 1) : undefined,
          checked: nodeType === 'task' ? false : undefined,
          level,
        },
        content: [
          {
            type: 'paragraph',
            content: isMultiSelect ? [] : sliceToBeMovedContent,
          },
        ],
      },
    ],
  }

  editor
    .chain()
    .insertContentAt(
      currentNodeEndPos + 2,
      parentParentNode.type.name === 'dBlock'
        ? newDblockContent
        : {
            type: nodeType,
            attrs: {
              number: nodeType === 'ordered' ? String(Number(parentNode.attrs.number) + 1) : undefined,
              checked: nodeType === 'task' ? false : undefined,
              level,
            },
            content: [
              {
                type: 'paragraph',
                content: isMultiSelect ? [] : sliceToBeMovedContent,
              },
            ],
          },
    )
    .setTextSelection(currentNodeEndPos + 1)
    .deleteRange({ from, to: currentNodeEndPos })
    .run()

  if (isOnEndOfLine && parentParentNode.type.name !== 'dBlock') {
    return false
  }

  if (isOnEndOfLine) {
    const pos = currentNodeEndPos + 6
    editor.chain().focus().setTextSelection(pos).run()
  }
  return true
}

export const onBackspaceWithNestedList = (editor: Editor, nodeType: string) => {
  const selection = editor.state.selection

  if (!selection.empty) return false

  let parentNodePos, parentNode, currentNode

  try {
    parentNodePos = selection.$from.before(selection.$from.depth - 1)
    parentNode = editor.state.selection.$from.node(-1)
    currentNode = editor.state.selection.$from.node()
  } catch (e) {
    return false
  }

  if (parentNode?.type.name !== nodeType) return false

  if (Number(parentNode.attrs.level) < 1) return false
  if (currentNode.textContent.length > 0) return false

  const view = editor.view
  const { tr } = view.state

  view.dispatch(tr.setNodeAttribute(parentNodePos, 'level', Number(parentNode.attrs.level) - 1))

  return true
}

export const changeLevel = (editor: Editor, nodeType: string, direction: 'forward' | 'backward') => {
  const selection = editor.state.selection

  if (selection.empty) {
    let currentNodePos, currentNode
    try {
      currentNodePos = selection.$from.before(selection.$from.depth - 1)
      currentNode = editor.state.selection.$from.node(-1)
    } catch (e) {
      return false
    }

    if (currentNode?.type.name !== nodeType) return false

    const view = editor.view
    const { tr } = view.state

    let newLevel = Number(currentNode.attrs.level) + (direction === 'forward' ? 1 : -1)
    newLevel = newLevel < 0 ? 0 : newLevel

    view.dispatch(tr.setNodeAttribute(currentNodePos, 'level', Number(newLevel)))

    return true
  } else {
    const state = editor.state
    const tr = state.tr
    const view = editor.view

    let topDBlockPos: number, bottomDBlockPos: number
    try {
      topDBlockPos = selection.$from.before(selection.$from.depth - 1)
      bottomDBlockPos = selection.$to.after(selection.$to.depth - 1)
    } catch (e) {
      return false
    }

    let found = false
    // traverse through the slice and change the level of the list items
    state.doc.descendants((node, pos) => {
      if (pos >= topDBlockPos && pos < bottomDBlockPos) {
        if (node.type.name === nodeType) {
          found = true

          let newLevel = Number(node.attrs.level) + (direction === 'forward' ? 1 : -1)
          newLevel = newLevel < 0 ? 0 : newLevel
          tr.setNodeAttribute(pos, 'level', Number(newLevel))

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

export const listItemPasteRule = ({
  nodeType,
  pasteRegex,
  inputRegex,
}: {
  nodeType: 'bullet' | 'ordered' | 'task'
  pasteRegex: RegExp
  inputRegex: RegExp
}) => {
  return new PasteRule({
    find: (text) => {
      return text.match(pasteRegex)?.map((matched, index) => {
        return {
          text: matched,
          index,
          data: { matched },
          start: index,
          end: index + matched.length,
        }
      })
    },
    handler({ match, chain, range, state }) {
      // If pasted on empty dblock
      let insertedPos = range.from

      const dBlocks: Array<{ pos: number; node: any }> = []
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'dBlock' && pos < range.from) {
          insertedPos = pos
          dBlocks.push({ pos, node })
        }
      })
      let emptyDBlockFound = false
      for (let i = dBlocks.length - 1; i >= 0; i--) {
        if (state.doc.nodeAt(dBlocks[i].pos)?.textContent.length === 0) {
          if (emptyDBlockFound) {
            insertedPos = dBlocks[i].pos
            break
          }
          emptyDBlockFound = true
          insertedPos = dBlocks[i].pos
        }
      }

      range.from = insertedPos

      let orderNumber = 1
      if (nodeType === 'ordered') {
        orderNumber = Number(match[0].trimStart().split('.')[0])
      }

      let isChecked = false
      if (nodeType === 'task') {
        isChecked = match[0].trimStart().replace(' ', '').startsWith('-[x]')
        isChecked = isChecked || match[0].trimStart().replace(' ', '').startsWith('-[X]')
        isChecked = isChecked || match[0].trimStart().replace(' ', '').startsWith('[x]')
        isChecked = isChecked || match[0].trimStart().replace(' ', '').startsWith('[X]')
      }

      const attrs = {} as any
      if (nodeType === 'ordered') {
        attrs.number = String(orderNumber)
      }
      if (nodeType === 'task') {
        attrs.checked = isChecked
      }

      chain()
        .deleteRange(range)
        .insertContentAt(insertedPos, {
          type: 'dBlock',
          content: [
            {
              type: nodeType,
              attrs,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: match[0].replace(inputRegex, ''),
                    },
                  ],
                },
              ],
            },
          ],
        })
    },
  })
}

export { toggleItem }
