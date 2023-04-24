import TiptapTableRow from '@tiptap/extension-table-row'
import { Plugin, PluginKey } from 'prosemirror-state'
import { TiptapNodesTypes } from 'nocodb-sdk'

const TableRow = TiptapTableRow.extend({
  name: TiptapNodesTypes.tableRow,
  selectable: true,
  content: '(tableCell)*',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey(TiptapNodesTypes.tableRow),
      }),
    ]
  },
}).configure({
  HTMLAttributes: {
    style: 'overflow: visible !important',
  },
})

export { TableRow }
