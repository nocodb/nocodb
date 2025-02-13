import type { ColumnType, TableType, UITypes, ViewType } from 'nocodb-sdk'
import type { Row } from '../../../../../lib/types'
import convertCellData from '../../../../../composables/useMultiSelect/convertCellData'
import { serializeRange } from '../../../../../utils/pasteUtils'

export function useFillHandler({
  isFillMode,
  selection,
  canvasRef,
  rowHeight,
  getFillHandlerPosition,
  triggerReRender,
  rowSlice,
  cachedRows,
  columns,
  bulkUpdateRows,
  meta,
  fillRange,
}: {
  selection: CellRange
  fillRange: CellRange
  canvasRef: Ref<HTMLCanvasElement>
  rowHeight: Ref<number>
  isFillMode: Ref<boolean>
  getFillHandlerPosition: () => FillHandlerPosition | null
  triggerReRender: () => void
  rowSlice: Ref<{ start: number; end: number }>
  columns: ComputedRef<CanvasGridColumn[]>
  cachedRows: Ref<Map<number, Row>>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  meta: Ref<TableType>
}) {
  const { isMysql, isPg } = useBase()

  const fillStartCell = ref<{ row: number; col: number } | null>(null)
  const isFillEnded = ref(false)

  const isOverFillHandler = (x: number, y: number) => {
    const handler = getFillHandlerPosition()
    if (!handler) return false

    const radius = handler.size / 2
    const dx = x - handler.x
    const dy = y - handler.y

    return dx * dx + dy * dy <= radius * radius
  }

  const handleFillStart = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return
    isFillEnded.value = false
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isOverFillHandler(x, y)) {
      isFillMode.value = true
      fillStartCell.value = {
        row: selection.end.row,
        col: selection.end.col,
      }
    }
    triggerReRender()
  }

  const handleFillMove = (e: MouseEvent) => {
    if (!isFillMode.value || !fillStartCell.value || isFillEnded.value) return

    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const y = e.clientY - rect.top
    const row = Math.floor((y - 32) / rowHeight.value)
    selection.endRange({
      row: row + rowSlice.value.start,
      col: fillStartCell.value.col,
    })
    triggerReRender()
  }

  const handleFillEnd = () => {
    if (isFillMode.value) {
      isFillEnded.value = true
      setTimeout(() => {
        isFillMode.value = false
        fillStartCell.value = null
        triggerReRender()
      }, 1000)
    }
  }

  return {
    getFillHandlerPosition,
    handleFillStart,
    handleFillMove,
    handleFillEnd,
  }
}
