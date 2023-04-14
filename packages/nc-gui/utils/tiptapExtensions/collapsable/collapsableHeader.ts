// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CollapsableComponent from './collapsableHeader.vue'

export const CollapsableHeader = Node.create({
  name: 'collapsable_header',
  priority: 1000,
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content() {
    return 'block+'
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="collapsableHeader"]',
        attrs: { 'data-type': 'collapsableHeader' },
      },
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(CollapsableComponent)
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
        'data-is-empty': node.textContent.length === 0 ? 'true' : 'false',
      }),
      0,
    ]
  },
})
