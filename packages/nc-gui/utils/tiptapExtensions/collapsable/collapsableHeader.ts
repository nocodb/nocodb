// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import CollapsableComponent from './collapsableHeader.vue'

export const CollapsableHeaderNode = Node.create({
  name: TiptapNodesTypes.collapsableHeader,
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
