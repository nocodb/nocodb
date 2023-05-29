import Table from '@tiptap/extension-table'
import { CellSelection, columnResizing, tableEditing } from '@tiptap/prosemirror-tables'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { TableNodeView } from './TableNodeView'
import TableComponent from './table.vue'

export default Table.extend({
  name: TiptapNodesTypes.table,
  draggable: true,
  resizable: true,
  isolating: true,

  addNodeView() {
    return VueNodeViewRenderer(TableComponent)
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const selection = this.editor.state.selection

        if (selection instanceof CellSelection) {
          let from = selection.ranges[0].$from.pos
          for (const range of selection.ranges) {
            if (range.$from.pos < from) {
              from = range.$from.pos
            }
          }

          if (selection.isRowSelection()) {
            this.editor
              .chain()
              .deleteRow()
              .setTextSelection(from - 4)
              .run()
          } else {
            this.editor.chain().deleteColumn().setTextSelection(from).run()
          }

          return true
        }

        return false
      },
    }
  },

  addProseMirrorPlugins() {
    return this.options.resizable
      ? [
          tableEditing({
            allowTableNodeSelection: true,
          }),
          columnResizing({
            handleWidth: 3,
            cellMinWidth: this.options.cellMinWidth,
            View: this.options.View,
            // @ts-expect-error (incorrect type)
            lastColumnResizable: false,
          }),
        ]
      : []
  },
}).configure({
  HTMLAttributes: {
    class: '',
  },
  View: TableNodeView as any,
})
