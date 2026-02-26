/**
 * Custom Table extensions for the doc editor.
 *
 * DocTable: Overrides @tiptap/extension-table to remove <colgroup> from renderHTML.
 * The default Tiptap Table includes a <colgroup> with <col> elements sized from each
 * cell's colwidth attr. ProseMirror only patches the content-hole (<tbody>), so the
 * <colgroup> goes stale after add/delete-column operations, leaving ghost columns that
 * show as empty space. Since we use CSS table-layout:fixed + width:100% for equal columns,
 * <colgroup> is unnecessary.
 *
 * DocTableCell / DocTableHeader: Override to ignore colwidth (we use CSS table-layout:fixed
 * for equal columns instead of pixel widths) and add a textAlign attribute for column-level
 * alignment.
 */
import { mergeAttributes } from '@tiptap/core'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'

export const DocTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ['tbody', 0]]
  },
})

const cellTextAlignAttr = {
  default: 'left',
  parseHTML: (el: HTMLElement) => el.style.textAlign || el.getAttribute('data-text-align') || 'left',
  renderHTML: (attrs: Record<string, any>) => {
    const align = attrs.textAlign
    if (!align || align === 'left') return {}
    if (!/^(left|center|right)$/.test(align)) return {}
    return { style: `text-align: ${align}` }
  },
}

export const DocTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...TableCell.config.addAttributes?.call(this),
      colwidth: { default: null, renderHTML: () => ({}) },
      textAlign: cellTextAlignAttr,
    }
  },
})

export const DocTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...TableHeader.config.addAttributes?.call(this),
      colwidth: { default: null, renderHTML: () => ({}) },
      textAlign: cellTextAlignAttr,
    }
  },
})
