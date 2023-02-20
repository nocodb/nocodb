import { VueNodeViewRenderer } from '@tiptap/vue-3'

import { Node, mergeAttributes } from '@tiptap/core'
import TableHeaderNodeView from './table-header.vue'

export interface TableHeaderOptions {
  HTMLAttributes: Record<string, any>
}
export const TableHeader = Node.create<TableHeaderOptions>({
  name: 'tableHeader',
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  content: 'block+',

  addAttributes() {
    return {
      colspan: {
        default: 1,
      },
      rowspan: {
        default: 1,
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const colwidth = element.getAttribute('colwidth')
          const value = colwidth ? [parseInt(colwidth, 10)] : null

          return value
        },
      },
    }
  },

  tableRole: 'header_cell',

  parseHTML() {
    return [{ tag: 'th' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(TableHeaderNodeView)
  },
})
