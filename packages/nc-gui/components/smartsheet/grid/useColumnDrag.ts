import type { ColumnType } from 'nocodb-sdk'

export const useColumnDrag = ({
  fields,
  tableBodyEl,
  gridWrapper,
}: {
  fields: Ref<ColumnType[]>
  tableBodyEl: Ref<HTMLElement | undefined>
  gridWrapper: Ref<HTMLElement | undefined>
}) => {
  const { updateGridViewColumn, gridViewCols } = useViewColumnsOrThrow()
  const { leftSidebarWidth } = storeToRefs(useSidebarStore())
  const { width } = useWindowSize()

  const draggedCol = ref<ColumnType | null>(null)
  const dragColPlaceholderDomRef = ref<HTMLElement | null>(null)
  const toBeDroppedColId = ref<string | null>(null)

  const reorderColumn = async (colId: string, toColId: string) => {
    const col = gridViewCols.value[colId]
    const toCol = gridViewCols.value[toColId]!
    const toColIndex = fields.value.findIndex((f) => f.id === toColId)
    const nextToColField = toColIndex < fields.value.length - 1 ? fields.value[toColIndex + 1] : null
    const nextToCol = nextToColField ? gridViewCols.value[nextToColField.id!] : null

    const newOrder = nextToCol ? toCol.order! + (nextToCol.order! - toCol.order!) / 2 : toCol.order! + 1

    col.order = newOrder

    await updateGridViewColumn(colId, { order: newOrder } as any)
  }

  const onDragStart = (colId: string, e: DragEvent) => {
    if (!e.dataTransfer) return

    const dom = document.querySelector('[data-testid="drag-icon-placeholder"]')

    e.dataTransfer.dropEffect = 'none'
    e.dataTransfer.effectAllowed = 'none'

    e.dataTransfer.setDragImage(dom!, 10, 10)
    e.dataTransfer.clearData()
    e.dataTransfer.setData('text/plain', colId)

    draggedCol.value = fields.value.find((f) => f.id === colId) ?? null
    dragColPlaceholderDomRef.value!.style.height = `${tableBodyEl.value?.getBoundingClientRect().height}px`
  }

  const onDrag = (e: DragEvent) => {
    if (!e.dataTransfer) return
    if (!draggedCol.value) return

    e.preventDefault()

    if (!dragColPlaceholderDomRef.value) return

    if (e.clientX === 0) {
      dragColPlaceholderDomRef.value!.style.left = `0px`
      dragColPlaceholderDomRef.value!.style.height = '0px'
      reorderColumn(draggedCol.value!.id!, toBeDroppedColId.value!)
      draggedCol.value = null
      toBeDroppedColId.value = null
      return
    }

    const y = dragColPlaceholderDomRef.value!.getBoundingClientRect().top
    const domsUnderMouse = document.elementsFromPoint(e.clientX, y)
    const columnDom = domsUnderMouse.find((dom) => dom.classList.contains('nc-grid-column-header'))

    if (columnDom) {
      toBeDroppedColId.value = columnDom?.getAttribute('data-col') ?? null
    }

    const x = e.clientX - leftSidebarWidth.value

    if (x >= 0) {
      dragColPlaceholderDomRef.value.style.left = `${x.toString()}px`
    }

    const remInPx = parseFloat(getComputedStyle(document.documentElement).fontSize)

    if (x > width.value * 0.5) {
      setTimeout(() => {
        gridWrapper.value!.scrollLeft += 2.5
      }, 250)
    } else if (x < leftSidebarWidth.value + 10 * remInPx) {
      setTimeout(() => {
        gridWrapper.value!.scrollLeft -= 2.5
      }, 250)
    }
  }

  return {
    onDrag,
    onDragStart,
    draggedCol,
    dragColPlaceholderDomRef,
    toBeDroppedColId,
  }
}
