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

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        // Do not delete the cell if the cell is empty
        const selectedCellContent = this.editor.view.state.selection.$head.node(-1)
        const parentNode = this.editor.view.state.selection.$anchor.node(-1)

        if (parentNode?.type.name !== 'tableCell') {
          return false
        }
        const selection = this.editor.view.state.selection

        const doc = this.editor.view.state.doc

        if (doc.nodeAt(selection.$from.pos - 2)?.type.name === 'tableCell') {
          return true
        }

        if (selectedCellContent.textContent.length === 0 && parentNode.childCount === 1) {
          return true
        }

        return false
      },
    }
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
