import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { CellSelection } from '@tiptap/pm/tables'
import TableCellNodeView from './table-cell.vue'
export interface TableCellOptions {
  HTMLAttributes: Record<string, any>
}

export const TableCell = Node.create<TableCellOptions>({
  name: TiptapNodesTypes.tableCell,

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
        const selection = this.editor.view.state.selection

        if (!selection.empty) return false

        if (parentNode?.type.name !== TiptapNodesTypes.tableCell) {
          return false
        }

        const doc = this.editor.view.state.doc

        if (doc.nodeAt(selection.$from.pos - 2)?.type.name === TiptapNodesTypes.tableCell) {
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
        key: new PluginKey(TiptapNodesTypes.tableCell),
        props: {},
        // On column resize mouse click event goes to cells as well which cause the cell to be selected (possible explanation)
        // This is a workaround to prevent the cell from being selected
        appendTransaction: (_, __, newState) => {
          const columnResizingPluginKey = this.editor.state.plugins.find((p) => (p as any).key.includes('tableColumnResizing'))!

          const colResizePluginState = columnResizingPluginKey.getState(newState)
          if (
            colResizePluginState.dragging &&
            // Handle the case where column resizing selects cells
            newState.selection instanceof CellSelection
          ) {
            return newState.tr.setSelection(TextSelection.create(newState.doc, newState.selection.from))
          }

          return null
        },
      }),
    ]
  },
})
