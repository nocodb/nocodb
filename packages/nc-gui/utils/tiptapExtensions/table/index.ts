import Table from '@tiptap/extension-table'
import type { EditorState } from 'prosemirror-state'
import { Plugin, PluginKey } from 'prosemirror-state'
import { TableMap, addColumn, addRow, columnResizing } from '@tiptap/prosemirror-tables'
import type { DecorationSource, EditorView } from 'prosemirror-view'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TableNodeView } from './TableNodeView'
import TableComponent from './table.vue'

export default Table.extend({
  draggable: true,
  resizable: true,

  addNodeView() {
    return VueNodeViewRenderer(TableComponent)
  },

  addProseMirrorPlugins() {
    return [
      columnResizing({
        handleWidth: 6,
        cellMinWidth: this.options.cellMinWidth,
        View: this.options.View,
        // TODO: PR for @types/prosemirror-tables
        // @ts-expect-error (incorrect type)
        lastColumnResizable: false,
      }),
    ]
  },
}).configure({
  HTMLAttributes: {
    class: '',
  },
  View: TableNodeView,
})
