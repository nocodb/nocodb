import { TextSelection } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import type { ChainedCommands } from '@tiptap/core'
import { Slice } from 'prosemirror-model'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { getPositionOfSection, nodeTypesContainingSection } from '../../helper'
import type { ListNodeType } from '.'

let prevOrderedListNodeNumber = 0

// Traverse the slice json and toggle the list item type
// If the list item is of type 'ordered', then also update the number attribute
const toggleListItemInSliceJson = ({ content, type }: { content: any[]; type: ListNodeType }) => {
  for (const child of content) {
    if (nodeTypesContainingSection.includes(child.type)) {
      if (child.type !== 'sec') {
        prevOrderedListNodeNumber = 0
      }

      toggleListItemInSliceJson({
        content: child.content,
        type,
      })
      continue
    }

    // If the child is a paragraph or a list item of different type, then toggle it to the given list node type
    if (child.type === 'paragraph' || ['ordered', 'bullet', 'task'].filter((val) => val !== type).includes(child.type)) {
      const childContent = child.type === 'paragraph' ? child.content : child.content[0].content
      child.content = [
        {
          type: 'paragraph',
          content: childContent,
        },
      ]
      child.type = type
      if (type === 'ordered') {
        child.attrs = {
          ...(child.attrs ?? {}),
          number: String(prevOrderedListNodeNumber + 1),
        }
      }

      prevOrderedListNodeNumber = prevOrderedListNodeNumber + 1
    } else if (child.type === type) {
      // If the child is a list item of the same type, then toggle it to a paragraph
      prevOrderedListNodeNumber = 0
      child.type = 'paragraph'

      // As list item will only have one paragraph as child
      if (child.content?.length === 1) {
        child.content = child.content[0].content
      } else {
        child.content = []
      }
    }
  }
}

export const toggleItem = ({ chain, type, state }: { chain: () => ChainedCommands; state: EditorState; type: ListNodeType }) => {
  console.log('toggleItem')
  const selection = state.selection
  const _currentSecNodePos = getPositionOfSection(state)
  const _nextSecNodeEndPos = getPositionOfSection(state, state.selection.to - 1, 'end')

  const _currentTableCellPos = getPositionOfTableCell(state)
  const _nextTableCellEndPos = getPositionOfTableCell(state, state.selection.to - 1, 'end')

  let isTableCellSelected = false
  let sliceStart: number
  let sliceEnd: number
  if (
    selection instanceof TextSelection &&
    !selection.empty &&
    _currentTableCellPos &&
    _nextTableCellEndPos &&
    _currentTableCellPos > _currentSecNodePos
  ) {
    sliceStart = _currentTableCellPos
    sliceEnd = _nextTableCellEndPos
    isTableCellSelected = true
  } else {
    sliceStart = _currentSecNodePos
    sliceEnd = _nextSecNodeEndPos
  }

  const sliceJson = state.doc.slice(sliceStart, sliceEnd, false).toJSON()

  // Toggle a list items under `sec` nodes in slice and reset the prevOrderedListNodeNumber
  prevOrderedListNodeNumber = 0
  if (isTableCellSelected) {
    sliceJson.content.forEach((node: any) => {
      node.type = type
      node.attrs = {
        ...(node.attrs ?? {}),
        number: String(prevOrderedListNodeNumber + 1),
      }

      prevOrderedListNodeNumber = prevOrderedListNodeNumber + 1
    })
  } else {
    toggleListItemInSliceJson({ content: sliceJson.content, type })
  }

  const newSlice = Slice.fromJSON(state.schema, sliceJson)

  console.log('newSlice', newSlice)

  return chain()
    .command(() => {
      state.tr.replaceRange(sliceStart, sliceEnd, newSlice)

      return true
    })
    .setTextSelection(sliceStart + newSlice.size - 1)
}

/**
 * Table cell list toggle helper
 */

const nodeTypesContainingTableCell = [
  TiptapNodesTypes.doc,
  TiptapNodesTypes.sec,
  TiptapNodesTypes.collapsable,
  TiptapNodesTypes.collapsableHeader,
  TiptapNodesTypes.collapsableContent,
  TiptapNodesTypes.column,
  TiptapNodesTypes.columnContent,
  TiptapNodesTypes.table,
  TiptapNodesTypes.tableRow,
  TiptapNodesTypes.tableCell,
]

function getPositionOfTableCell(state: EditorState, pos?: number, type: 'start' | 'end' | undefined = 'start') {
  const searchStopPos = pos ?? state.selection.$from.pos
  let sectionPos = 0
  state.doc.descendants((node, _pos) => {
    if (node.type.name === TiptapNodesTypes.tableCell && _pos < searchStopPos) {
      sectionPos = _pos
    }

    if (nodeTypesContainingTableCell.includes(node.type.name as TiptapNodesTypes)) {
      return true
    }

    return false
  })

  if (type === 'end') {
    const sectionNode = state.doc.nodeAt(sectionPos)!

    return sectionPos + sectionNode?.nodeSize - 1
  }

  return sectionPos
}
