import TiptapTableRow from '@tiptap/extension-table-row'
import { Plugin, PluginKey } from 'prosemirror-state'

const TableRow = TiptapTableRow.extend({
  selectable: true,
  content: '(tableCell)*',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableRow'),
      }),
    ]
  },
}).configure({
  HTMLAttributes: {
    style: 'overflow: visible !important',
  },
})

export { TableRow }
