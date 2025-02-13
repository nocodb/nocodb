import { type ColumnType } from 'nocodb-sdk'
import { useDataFetch } from './useDataFetch'

export function useCanvasTable({
  rowHeightEnum,
  cachedRows,
  clearCache,
  chunkStates,
  totalRows,
  loadData,
}: {
  rowHeightEnum?: number
  cachedRows: Ref<Map<number, Row>>
  clearCache: (start: number, end: number) => void
  chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
  totalRows: Ref<number>
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
}) {
  const rowSlice = ref({ start: 0, end: 0 })
  const colSlice = ref({ start: 0, end: 0 })
  const activeCell = ref({ row: -1, column: -1 })
  const editEnabled = ref<{
    rowIndex: number
    column: ColumnType
    row: Row
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const { isMobileMode } = useGlobal()
  const { gridViewCols } = useViewColumnsOrThrow()
  const { fetchChunk, updateVisibleRows } = useDataFetch({ cachedRows, chunkStates, clearCache, totalRows, loadData, rowSlice })

  const fields = inject(FieldsInj, ref([]))

  const rowHeight = computed(() => (isMobileMode.value ? 56 : rowHeightInPx[`${rowHeightEnum}`] ?? 32))

  const columns = computed(() => {
    const cols = fields.value
      .map((f) => {
        const gridViewCol = gridViewCols.value[f.id!]

        if (!gridViewCol) return false

        return {
          id: f.id,
          grid_column_id: gridViewCol.id,
          title: f.title,
          uidt: f.uidt,
          width: gridViewCol.width,
          fixed: f.pv,
          pv: !!f.pv,
        }
      })
      .filter((c) => !!c)
    cols.splice(0, 0, {
      id: 'row_number',
      grid_column_id: 'row_number',
      title: '#',
      uidt: null,
      width: '80',
      fixed: true,
      pv: false,
    })
    return cols
  })

  const totalWidth = computed(() => {
    return columns.value.reduce((acc, col) => acc + +(col.width?.split('px')?.[0] ?? 50), 0) + 256
  })

  const columnWidths = computed(() => columns.value.map((col) => parseInt(col.width!, 10)))

  const findColumnIndex = (target: number, _start = 0, end = columnWidths.value.length) => {
    let accumulatedWidth = 0

    for (let i = 0; i < end; i++) {
      if (accumulatedWidth > target) {
        return Math.max(0, i - 1)
      }
      accumulatedWidth += columnWidths.value[i] ?? 0
    }

    return end - 1
  }

  return {
    rowSlice,
    colSlice,
    activeCell,
    editEnabled,
    rowHeight,
    totalWidth,
    columnWidths,
    columns,
    // Functions
    fetchChunk,
    updateVisibleRows,
    findColumnIndex,
  }
}
