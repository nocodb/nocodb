import type { ColumnType } from 'nocodb-sdk'
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
  handleClick: async (props) => {
    const cellRenderer = getLtarCellRenderer(props.column.columnObj)
    if (cellRenderer) {
      return cellRenderer?.handleClick?.(props)
    }
  },
}
