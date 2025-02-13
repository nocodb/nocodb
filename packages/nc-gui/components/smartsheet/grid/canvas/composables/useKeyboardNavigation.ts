import type { UITypes } from 'nocodb-sdk'

export function useKeyboardNavigation({
  totalRows,
  activeCell,
  columns,
  triggerReRender,
  scrollToCell,
}: {
  totalRows: Ref<number>
  activeCell: Ref<{ row: number; column: number }>
  triggerReRender: () => void
  columns: ComputedRef<
    | {
        id: string
        grid_column_id: string
        title: string
        width: string
        uidt: keyof typeof UITypes | null
        fixed: boolean
        pv: boolean
      }[]
  >
  scrollToCell: (row: number, column: number) => void
}) {
  const handleKeyDown = (e: KeyboardEvent) => {
    e.preventDefault()

    switch (e.key) {
      case 'ArrowUp':
        if (activeCell.value.row > 0) {
          activeCell.value.row--
          scrollToCell(activeCell.value.row, activeCell.value.column)
        }
        break

      case 'ArrowDown':
        if (activeCell.value.row < totalRows.value - 1) {
          activeCell.value.row++
          scrollToCell(activeCell.value.row, activeCell.value.column)
        }
        break

      case 'ArrowLeft':
        if (activeCell.value.column > 1) {
          activeCell.value.column--
          scrollToCell(activeCell.value.row, activeCell.value.column)
        }
        break

      case 'ArrowRight':
        if (activeCell.value.column < columns.value.length - 1) {
          activeCell.value.column++
          scrollToCell(activeCell.value.row, activeCell.value.column)
        }
        break

      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          // Move left
          if (activeCell.value.column > 1) {
            activeCell.value.column--
          } else if (activeCell.value.row > 0) {
            activeCell.value.row--
            activeCell.value.column = columns.value.length - 1
          }
        } else {
          // Move right
          if (activeCell.value.column < columns.value.length - 1) {
            activeCell.value.column++
          } else if (activeCell.value.row < totalRows.value - 1) {
            activeCell.value.row++
            activeCell.value.column = 1
          }
        }
        scrollToCell(activeCell.value.row, activeCell.value.column)
        break
    }
    triggerReRender()
  }

  useEventListener('keydown', handleKeyDown)
}
