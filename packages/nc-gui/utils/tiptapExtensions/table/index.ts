import Table from '@tiptap/extension-table'
import { columnResizing, tableEditing } from '@tiptap/prosemirror-tables'
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

  addProseMirrorPlugins() {
    return this.options.resizable
      ? [
          tableEditing(),
          columnResizing({
            handleWidth: 3,
            cellMinWidth: this.options.cellMinWidth,
            View: this.options.View,
            // TODO: PR for @types/prosemirror-tables
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
