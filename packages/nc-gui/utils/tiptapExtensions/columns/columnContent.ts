import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import ColumnContent from './column-content.vue'

export const ColumnContentNode = Node.create({
  name: TiptapNodesTypes.columnContent,

  addAttributes() {
    return {
      widthPercent: {
        default: 50,
        parseHTML: (element) => {
          const colwidth = element.getAttribute('widthPercent')
          const value = colwidth ? [parseInt(colwidth, 10)] : null

          return value
        },
      },
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'flex column-content items-baseline',
      },
    }
  },
  content: 'sec+',

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="column-content"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column-content' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(ColumnContent)
  },
})
