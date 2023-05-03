// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'
import { TiptapNodesTypes } from 'nocodb-sdk'

export const CollapsableContentNode = Node.create({
  name: TiptapNodesTypes.collapsableContent,
  priority: 1000,
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content() {
    return 'sec+'
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${TiptapNodesTypes.collapsableContent}"]`,
        attrs: { 'data-type': TiptapNodesTypes.collapsableContent },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': TiptapNodesTypes.collapsableContent,
      }),
      0,
    ]
  },
})
