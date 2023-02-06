import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { Plugin, PluginKey } from 'prosemirror-state'
import TableCellNodeView from './table-cell.vue'

export interface TableCellOptions {
  HTMLAttributes: Record<string, any>
}

export const TableCell = Node.create<TableCellOptions>({
  name: 'tableCell',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  content: 'block+',

  draggable: false,
  selectable: false,

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

  tableRole: 'cell',

  parseHTML() {
    return [{ tag: 'td' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(TableCellNodeView)
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableCell'),
        props: {},
      }),
    ]
  },
})
