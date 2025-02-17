import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import { EmailCellEditor, EmailCellRenderer } from './cells/Email'

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

export interface CellEditor {
  mount: (
    container: HTMLElement,
    options: {
      value: any
      row: any
      column: ColumnType
      x: number
      y: number
      width: number
      height: number
      onSave: (value: any) => void
      onCancel: () => void
    },
  ) => void
  destroy: () => void
}

export interface CellType {
  type: string
  renderer: CellRenderer
  editor?: CellEditor
}

export function useCellRenderer() {
  const cellTypesRegistry = new Map<string, CellType>()

  const registerCellType = (type: string, renderer: CellRenderer, editor?: CellEditor) => {
    cellTypesRegistry.set(type, { type, renderer, editor })
  }

  const getCellEditor = (columnType: string) => {
    return cellTypesRegistry.get(columnType)?.editor
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
      cellType.renderer.render(ctx, {
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
    registerCellType(UITypes.Email, EmailCellRenderer, EmailCellEditor)
  })

  return {
    cellTypesRegistry,
    registerCellType,
    renderCell,
    getCellEditor,
  }
}
