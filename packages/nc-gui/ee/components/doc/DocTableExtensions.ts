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
 *
 * addRowBefore / addRowAfter overrides: After inserting a new row, copy textAlign
 * from the reference row so new cells inherit column alignment.
 */
import { mergeAttributes } from '@tiptap/core'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { TableMap, addRowAfter, addRowBefore, selectedRect } from '@tiptap/pm/tables'
import { TextSelection, type Transaction } from '@tiptap/pm/state'

interface CellAlignment {
  textAlign: string
  verticalAlign: string
}

/**
 * Read textAlign and verticalAlign of each column from a given row in the table.
 */
function getRowAlignments(table: any, map: any, rowIndex: number): CellAlignment[] {
  const alignments: CellAlignment[] = []
  for (let col = 0; col < map.width; col++) {
    const cellOffset = map.map[rowIndex * map.width + col]
    const node = table.nodeAt(cellOffset)
    alignments.push({
      textAlign: node?.attrs?.textAlign || 'left',
      verticalAlign: node?.attrs?.verticalAlign || 'top',
    })
  }
  return alignments
}

/**
 * Patch a newly inserted row's cells to inherit alignment from the given alignments,
 * then place the cursor inside the first cell of the new row.
 *
 * @param tableStart - Content start of the table (from selectedRect.tableStart)
 */
function patchNewRow(tr: Transaction, tableStart: number, newRowIndex: number, alignments: CellAlignment[]) {
  // tableStart points to content start; table node is one position before
  const table = tr.doc.nodeAt(tableStart - 1)
  if (!table) return

  const map = TableMap.get(table)

  for (let col = 0; col < map.width && col < alignments.length; col++) {
    const { textAlign, verticalAlign } = alignments[col]
    if (textAlign === 'left' && verticalAlign === 'top') continue

    const cellOffset = map.map[newRowIndex * map.width + col]
    const node = table.nodeAt(cellOffset)
    if (!node) continue

    tr.setNodeMarkup(tableStart + cellOffset, undefined, {
      ...node.attrs,
      textAlign,
      verticalAlign,
    })
  }

  // Place cursor inside the first cell of the new row
  const firstCellOffset = map.map[newRowIndex * map.width]
  // +1 to enter the cell node, then resolve to find the innermost text position
  const $pos = tr.doc.resolve(tableStart + firstCellOffset + 1)
  tr.setSelection(TextSelection.near($pos))
}

export const DocTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ['tbody', 0]]
  },

  addCommands() {
    return {
      ...this.parent?.(),

      addRowBefore:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return addRowBefore(state)

          // Capture column alignments from the current row before insertion
          const rect = selectedRect(state)
          const alignments = getRowAlignments(rect.table, rect.map, rect.top)

          // Run the default addRowBefore, intercepting the transaction
          return addRowBefore(state, (tr) => {
            // New row is at rect.top; reference row shifted to rect.top + 1
            patchNewRow(tr, rect.tableStart, rect.top, alignments)
            dispatch(tr)
          })
        },

      addRowAfter:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return addRowAfter(state)

          // Capture column alignments from the last selected row
          const rect = selectedRect(state)
          const refRow = rect.bottom - 1
          const alignments = getRowAlignments(rect.table, rect.map, refRow)

          // Run the default addRowAfter, intercepting the transaction
          return addRowAfter(state, (tr) => {
            // New row is at rect.bottom
            patchNewRow(tr, rect.tableStart, rect.bottom, alignments)
            dispatch(tr)
          })
        },
    }
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

const cellVerticalAlignAttr = {
  default: 'top',
  parseHTML: (el: HTMLElement) => el.style.verticalAlign || el.getAttribute('data-vertical-align') || 'top',
  renderHTML: (attrs: Record<string, any>) => {
    const align = attrs.verticalAlign
    if (!align || align === 'top') return {}
    if (!/^(top|middle|bottom)$/.test(align)) return {}
    return { style: `vertical-align: ${align}` }
  },
}

export const DocTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...TableCell.config.addAttributes?.call(this),
      colwidth: {
        default: null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.colwidth || !attrs.colwidth[0]) return {}
          return { style: `width: ${attrs.colwidth[0]}px` }
        },
      },
      textAlign: cellTextAlignAttr,
      verticalAlign: cellVerticalAlignAttr,
    }
  },
})

export const DocTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...TableHeader.config.addAttributes?.call(this),
      colwidth: {
        default: null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.colwidth || !attrs.colwidth[0]) return {}
          return { style: `width: ${attrs.colwidth[0]}px` }
        },
      },
      textAlign: cellTextAlignAttr,
      verticalAlign: cellVerticalAlignAttr,
    }
  },
})
