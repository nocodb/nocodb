import type { EditorState } from 'prosemirror-state'
import type { ChainedCommands } from '@tiptap/core'
import { Slice } from 'prosemirror-model'
import { getPosOfNodeWrtAnchorNode } from './getPosOfNodeWrtAnchorNode'

let prevOrderedListNodeNumber = 0

const toggleListItemInSliceJson = ({ content, type }: { content: any[]; type: 'ordered' | 'bullet' | 'task' }) => {
  for (const child of content) {
    if (
      child.type === 'dBlock' ||
      child.type === 'collapsable' ||
      child.type === 'collapsable_content' ||
      child.type === 'collapsable_header'
    ) {
      if (child.type !== 'dBlock') {
        prevOrderedListNodeNumber = 0
      }

      toggleListItemInSliceJson({
        content: child.content,
        type,
      })
      continue
    }

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
          number: String(prevOrderedListNodeNumber + 1),
        }
      }

      prevOrderedListNodeNumber = prevOrderedListNodeNumber + 1
    } else if (child.type === type) {
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

export const toggleItem = ({
  chain,
  type,
  state,
}: {
  chain: () => ChainedCommands
  state: EditorState
  type: 'ordered' | 'bullet' | 'task'
}) => {
  const topDBlockPos = getPosOfNodeWrtAnchorNode({
    state,
    anchorPos: state.selection.$from.pos,
    direction: 'before',
    nodeType: 'dBlock',
    possibleParentTypes: ['dBlock', 'doc', 'collapsable', 'collapsable_content'],
  })

  const bottomDBlockPos = getPosOfNodeWrtAnchorNode({
    state,
    anchorPos: state.selection.$to.pos,
    direction: 'after',
    nodeType: 'dBlock',
    possibleParentTypes: ['dBlock', 'doc', 'collapsable', 'collapsable_content'],
  })

  const slice = state.doc.slice(topDBlockPos, bottomDBlockPos, false)
  const sliceJson = slice.toJSON()

  // Toggle a bullet under `dblock` nodes in slice
  prevOrderedListNodeNumber = 0
  toggleListItemInSliceJson({ content: sliceJson.content, type })

  const newSlice = Slice.fromJSON(state.schema, sliceJson)

  return chain()
    .command(() => {
      const tr = state.tr
      tr.replaceRange(topDBlockPos, bottomDBlockPos, newSlice)

      return true
    })
    .setTextSelection(topDBlockPos + newSlice.size - 1)
}
