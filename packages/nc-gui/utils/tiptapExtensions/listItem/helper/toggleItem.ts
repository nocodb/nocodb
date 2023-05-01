import type { EditorState } from 'prosemirror-state'
import type { ChainedCommands } from '@tiptap/core'
import { Slice } from 'prosemirror-model'
import { nodeTypesContainingSection } from '../../helper'
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
  const currentSecNodePos = getPositionOfSection(state)
  const nextSecNodeEndPos = getPositionOfSection(state, state.selection.to - 1, 'end')

  const sliceJson = state.doc.slice(currentSecNodePos, nextSecNodeEndPos, false).toJSON()

  // Toggle a list items under `sec` nodes in slice and reset the prevOrderedListNodeNumber
  prevOrderedListNodeNumber = 0
  toggleListItemInSliceJson({ content: sliceJson.content, type })

  const newSlice = Slice.fromJSON(state.schema, sliceJson)

  return chain()
    .command(() => {
      state.tr.replaceRange(currentSecNodePos, nextSecNodeEndPos, newSlice)

      return true
    })
    .setTextSelection(currentSecNodePos + newSlice.size - 1)
}
