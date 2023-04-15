import type { EditorState, Transaction } from 'prosemirror-state'
import type { Fragment } from 'prosemirror-model'
import type { ChainedCommands, Editor } from '@tiptap/core'
import { Slice } from 'prosemirror-model'

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
      return text
    }

    if (sliceJson.content) {
      for (const content of sliceJson.content) {
        text = text + getText(content, '')
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
  if (parentNode.type.name !== nodeType) return false
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

export const toggleItem = (
  editor: Editor,
  state: EditorState,
  chain: () => ChainedCommands,
  toggleListItemInSliceJson: any,
  type: 'ordered' | 'bullet' | 'task',
) => {
  const { selection } = state

  let isDBlockSelected = false
  try {
    const parentNode = selection.$from.node(-1)
    const parentParentNode = selection.$from.node(-2)
    isDBlockSelected =
      parentNode.type.name === 'dBlock' ||
      (parentParentNode.type.name === 'dBlock' && ['bullet', 'ordered', 'task'].includes(parentNode.type.name))
  } catch {}

  if (isDBlockSelected) {
    const topDBlockPos = getPosOfNodeWrtAnchorNode({
      state,
      anchorPos: state.selection.$from.pos,
      direction: 'before',
      nodeType: 'dBlock',
      possibleParentTypes: ['dBlock', 'doc', 'collapsable', 'collapsable_content'],
    })

    const bottomDBlockPos = getPosOfNodeWrtAnchorNode({
      state,
      anchorPos: state.selection.$from.pos,
      direction: 'after',
      nodeType: 'dBlock',
      possibleParentTypes: ['dBlock', 'doc', 'collapsable', 'collapsable_content'],
    })

    const slice = state.doc.slice(topDBlockPos, bottomDBlockPos, false)
    const sliceJson = slice.toJSON()

    if (JSON.stringify(sliceJson).includes('"type":"collapsable"')) {
      editor
        .chain()
        .setNodeSelection(topDBlockPos)
        .deleteSelection()
        .setTextSelection(topDBlockPos + 1)
        .run()

      return true
    }

    // Toggle a bullet under `dblock` nodes in slice
    let lastItemNode
    for (const node of sliceJson.content) {
      if (node.type === 'dBlock') {
        toggleListItemInSliceJson(node.content, lastItemNode)
      }

      const firstChildNode = node.content.length > 0 ? node.content[0] : null
      if (firstChildNode?.type === 'ordered' && type === 'ordered') {
        lastItemNode = firstChildNode
      }
    }

    const newSlice = Slice.fromJSON(state.schema, sliceJson)
    const isEmpty = getTextFromSliceJson(sliceJson).length === 0

    return chain()
      .command(() => {
        const tr = state.tr
        tr.replaceRange(topDBlockPos, bottomDBlockPos, newSlice)

        return true
      })
      .setTextSelection(isEmpty ? topDBlockPos + newSlice.size - 1 : topDBlockPos + newSlice.size - 2)
  }

  let listItemStartPos = selection.from

  let selectionSlice = state.doc.slice(listItemStartPos, selection.to)
  let selectionSliceJson = selectionSlice.toJSON()

  // Handle the case of selecting a single list item
  // As then only text node will be selected
  // Without the list item node
  const parentNodePos = selection.$from.before(selection.$from.depth - 1)
  const parentNode = state.doc.nodeAt(parentNodePos)
  if (selectionSliceJson.content.length === 1 && parentNode && ['bullet', 'ordered', 'task'].includes(parentNode.type.name)) {
    listItemStartPos = selection.$from.before(selection.$from.depth - 1)

    selectionSlice = state.doc.slice(listItemStartPos, selection.to)
    selectionSliceJson = selectionSlice.toJSON()
  }

  toggleListItemInSliceJson(selectionSliceJson.content)

  const newSlice = Slice.fromJSON(state.schema, { ...selectionSliceJson, openStart: 0 })

  return (chain() as ChainedCommands)
    .command(() => {
      const tr = state.tr
      tr.replaceRange(selection.from, selection.to, newSlice)

      return true
    })
    .setTextSelection(selection.from + 1)
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

  if (parentNode.type.name !== nodeType) return false

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

function getPosOfNodeWrtAnchorNode({
  state,
  anchorPos,
  nodeType,
  possibleParentTypes,
  direction,
}: {
  state: EditorState
  anchorPos: number
  nodeType: string
  possibleParentTypes: string[]
  direction: 'before' | 'after'
}) {
  let pos = direction === 'before' ? 0 : Infinity
  state.doc.descendants((node, nodePos) => {
    const beforeCondition = nodePos > pos && nodePos < anchorPos
    const afterCondition = nodePos > anchorPos && nodePos < pos
    if (node.type.name === nodeType && (direction === 'before' ? beforeCondition : afterCondition)) {
      pos = nodePos
    }

    // console.log('node', node.type.name, node.textContent, nodePos)
    return possibleParentTypes.includes(node.type.name)
  })

  return pos
}
