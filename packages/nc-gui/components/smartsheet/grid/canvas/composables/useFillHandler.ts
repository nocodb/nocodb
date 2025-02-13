export function useFillHandler({
  isFillMode,
  selection,
  canvasRef,
  rowHeight,
  getFillHandlerPosition,
  triggerReRender,
}: {
  selection: Ref<CellRange>
  canvasRef: Ref<HTMLCanvasElement>
  rowHeight: Ref<number>
  isFillMode: Ref<boolean>
  getFillHandlerPosition: () => FillHandlerPosition | null
  triggerReRender: () => void
}) {
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
        row: selection.value.end.row,
        col: selection.value.end.col,
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

    selection.value.endRange({
      row,
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
