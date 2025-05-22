import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { BelongsToCellRenderer } from './BelongsTo'
import { HasManyCellRenderer } from './HasMany'
import { ManyToManyCellRenderer } from './ManyToMany'
import { OneToOneCellRenderer } from './OneToOne'

export const getLtarCellRenderer = (column: ColumnType): CellRenderer | undefined => {
  if (isHm(column)) return HasManyCellRenderer
  if (isMm(column)) return ManyToManyCellRenderer
  if (isBt(column)) return BelongsToCellRenderer
  if (isOo(column)) return OneToOneCellRenderer
}

export const LtarCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const cellRenderer = getLtarCellRenderer(props.column)
    if (cellRenderer) {
      return cellRenderer.render(ctx, props)
    }
  },
  handleClick: async (_props) => {
    let props = _props

    const colOption = props.column?.colOptions as LinkToAnotherRecordType

    if (colOption?.fk_related_base_id && colOption.fk_related_base_id !== colOption.base_id) {
      const relatedBaseId = colOption?.fk_related_base_id
      const { isUIAllowed } = useRoles()
      const baseRoles = props.baseRoles?.[relatedBaseId]

      // Load related table meta if not present
      if (!baseRoles) {
        if (props.baseRoleLoader.isLoading(relatedBaseId)) return

        props.baseRoleLoader.loadBaseRole(relatedBaseId)
        return
      }

      props = {
        ...props,
        readonly: props.readonly || !isUIAllowed('dataEdit', baseRoles),
      }
    }

    const cellRenderer = getLtarCellRenderer(props.column.columnObj)
    if (cellRenderer) {
      return cellRenderer?.handleClick?.(props)
    }
  },
  handleKeyDown: async (props) => {
    const { row, column, e, makeCellEditable } = props

    if (isExpandCellKey(e)) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  handleHover: async (props) => {
    const cellRenderer = getLtarCellRenderer(props.column.columnObj)
    if (cellRenderer) {
      return cellRenderer?.handleHover?.(props)
    }
  },
}
