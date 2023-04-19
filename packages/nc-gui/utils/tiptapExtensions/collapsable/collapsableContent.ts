// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'

export const CollapsableContent = Node.create({
  name: 'collapsable_content',
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
        tag: 'div[data-type="collapsableContent"]',
        attrs: { 'data-type': 'collapsableContent' },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
      }),
      0,
    ]
  },
})
