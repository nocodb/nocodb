import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import { EmailCellRenderer } from './cells/Email'

export interface CellRenderer {
  render: (
    ctx: CanvasRenderingContext2D,
    options: {
      value: any
      row: any
      column: ColumnType
      x: number
      y: number
      width: number
      height: number
      selected: boolean
    },
  ) => void
}

export function useCellRenderer() {
  const cellTypesRegistry = new Map<string, CellRenderer>()

  const registerCellType = (type: string, renderer: CellRenderer) => {
    cellTypesRegistry.set(type, renderer)
  }

  const renderCell = (
    ctx: CanvasRenderingContext2D,
    column: any,
    {
      value,
      row,
      x,
      y,
      width,
      height,
      selected = false,
    }: {
      value: any
      row: any
      x: number
      y: number
      width: number
      height: number
      selected?: boolean
    },
  ) => {
    const cellType = cellTypesRegistry.get(column.uidt)

    if (cellType) {
      cellType.render(ctx, {
        value,
        row,
        column,
        x,
        y,
        width,
        height,
        selected,
      })
    } else {
      ctx.fillStyle = '#4a5268'
      ctx.font = '400 12px Manrope'
      ctx.textBaseline = 'middle'
      ctx.fillText(value?.toString() ?? '', x + 10, y + height / 2)
    }
  }

  onMounted(() => {
    registerCellType(UITypes.Email, EmailCellRenderer)
  })

  return {
    cellTypesRegistry,
    registerCellType,
    renderCell,
  }
}
