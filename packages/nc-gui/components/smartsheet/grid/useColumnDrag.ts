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
  const { eventBus, isDefaultView, meta } = useSmartsheetStoreOrThrow()
  const { addUndo, defineViewScope } = useUndoRedo()

  const { activeView } = storeToRefs(useViewsStore())

  const { gridViewCols, updateGridViewColumn } = useViewColumnsOrThrow()
  const { leftSidebarWidth } = storeToRefs(useSidebarStore())
  const { width } = useWindowSize()

  const isProcessing = ref<boolean>(false)
  const draggedCol = ref<ColumnType | null>(null)
  const dragColPlaceholderDomRef = ref<HTMLElement | null>(null)
  const toBeDroppedColId = ref<string | null>(null)

  const updateDefaultViewColumnOrder = (columnId: string, order: number) => {
    if (!meta.value?.columns) return

    meta.value.columns = (meta.value.columns || []).map((c: ColumnType) => {
      if (c.id !== columnId) return c

      c.meta = { ...parseProp(c.meta || {}), defaultViewColOrder: order }
      return c
    })

    if (meta.value?.columnsById?.[columnId]) {
      meta.value.columnsById[columnId].meta = { ...parseProp(meta.value.columnsById[columnId].meta), defaultViewColOrder: order }
    }
  }

  const reorderColumn = async (colId: string, toColId: string) => {
    const toBeReorderedViewCol = gridViewCols.value[colId]

    const toViewCol = gridViewCols.value[toColId]

    // if toBeReorderedViewCol/toViewCol is null, return
    if (!toBeReorderedViewCol || !toViewCol) return

    const toColIndex = fields.value.findIndex((f) => f.id === toColId)

    const nextToColField = toColIndex < fields.value.length - 1 ? fields.value[toColIndex + 1] : null
    const nextToViewCol = nextToColField ? gridViewCols.value[nextToColField.id!] : null

    const lastCol = fields.value[fields.value.length - 1]
    const lastViewCol = gridViewCols.value[lastCol.id!]

    // if nextToViewCol/toViewCol is null, return
    if (nextToViewCol === null && lastViewCol === null) return

    const newOrder = nextToViewCol ? toViewCol.order! + (nextToViewCol.order! - toViewCol.order!) / 2 : lastViewCol.order! + 1
    const oldOrder = toBeReorderedViewCol.order

    toBeReorderedViewCol.order = newOrder

    if (isDefaultView.value && toBeReorderedViewCol.fk_column_id) {
      updateDefaultViewColumnOrder(toBeReorderedViewCol.fk_column_id, newOrder)
    }

    addUndo({
      undo: {
        fn: async () => {
          if (!fields.value) return

          toBeReorderedViewCol.order = oldOrder
          if (isDefaultView.value) {
            updateDefaultViewColumnOrder(toBeReorderedViewCol.fk_column_id, oldOrder)
          }
          await updateGridViewColumn(colId, { order: oldOrder } as any)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
        },
        args: [],
      },
      redo: {
        fn: async () => {
          if (!fields.value) return

          toBeReorderedViewCol.order = newOrder
          if (isDefaultView.value) {
            updateDefaultViewColumnOrder(toBeReorderedViewCol.fk_column_id, newOrder)
          }
          await updateGridViewColumn(colId, { order: newOrder } as any)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
        },
        args: [],
      },
      scope: defineViewScope({ view: activeView.value }),
    })

    await updateGridViewColumn(colId, { order: newOrder } as any, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
  }

  const handleReorderColumn = async () => {
    isProcessing.value = true
    try {
      if (!dragColPlaceholderDomRef.value) return

      dragColPlaceholderDomRef.value!.style.left = '0px'
      dragColPlaceholderDomRef.value!.style.height = '0px'
      await reorderColumn(draggedCol.value!.id!, toBeDroppedColId.value!)
    } catch (error) {
      console.error('Failed to reorder column: ', error)
    } finally {
      isProcessing.value = false
    }
    draggedCol.value = null
    toBeDroppedColId.value = null
  }

  const onDragStart = (colId: string, e: DragEvent) => {
    if (!e.dataTransfer) return

    const dom = document.querySelector('[data-testid="drag-icon-placeholder"]')

    if (!dom || !dragColPlaceholderDomRef.value) return

    e.dataTransfer.dropEffect = 'none'
    e.dataTransfer.effectAllowed = 'none'

    e.dataTransfer.setDragImage(dom!, 10, 10)
    e.dataTransfer.clearData()
    e.dataTransfer.setData('text/plain', colId)

    draggedCol.value = fields.value.find((f) => f.id === colId) ?? null

    const remInPx = parseFloat(getComputedStyle(document.documentElement).fontSize)

    const placeholderHeight = tableBodyEl.value?.getBoundingClientRect().height ?? 6.1 * remInPx
    dragColPlaceholderDomRef.value!.style.height = `${placeholderHeight}px`

    const x = e.clientX - leftSidebarWidth.value

    if (x >= 0 && dragColPlaceholderDomRef.value) {
      dragColPlaceholderDomRef.value.style.left = `${x.toString()}px`
    }
  }

  const onDrag = (e: DragEvent) => {
    e.preventDefault()

    if (!e.dataTransfer) return
    if (!draggedCol.value) return

    if (!dragColPlaceholderDomRef.value) return

    if (e.clientX === 0) {
      handleReorderColumn()
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

    if (x < leftSidebarWidth.value + 1 * remInPx) {
      setTimeout(() => {
        gridWrapper.value!.scrollLeft -= 2.5
      }, 250)
    } else if (width.value - x - leftSidebarWidth.value < 15 * remInPx) {
      setTimeout(() => {
        gridWrapper.value!.scrollLeft += 2.5
      }, 250)
    }
  }

  // fallback for safari browser
  const onDragEnd = async (e: DragEvent) => {
    e.preventDefault()

    await until(() => !isProcessing.value).toBeTruthy()

    if (!e.dataTransfer || !draggedCol.value || !toBeDroppedColId.value) return

    handleReorderColumn()
  }

  return {
    onDrag,
    onDragStart,
    onDragEnd,
    draggedCol,
    dragColPlaceholderDomRef,
    toBeDroppedColId,
  }
}
