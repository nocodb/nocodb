import { Node } from '@tiptap/core'

export const Document = Node.create({
  name: 'doc',

  topNode: true,

  // content: "draggableBlock{1,}", // accepts one or more draggable block as content
  content: 'dBlock+',
})
