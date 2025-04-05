import type { ColumnType, TableType, UITypes, ViewType } from 'nocodb-sdk'
import { ComputedTypePasteError, TypeConversionError } from 'nocodb-sdk'
import type { Row } from '../../../../../lib/types'
import convertCellData from '../../../../../composables/useMultiSelect/convertCellData'
import { serializeRange } from '../../../../../utils/pasteUtils'
import { type CanvasElement, ElementTypes } from '../utils/CanvasElement'

export function useFillHandler({
  isFillMode,
  isAiFillMode,
  selection,
  canvasRef,
  getFillHandlerPosition,
  triggerReRender,
  columns,
  bulkUpdateRows,
  meta,
  activeCell,
  isPasteable,
  elementMap,
  getDataCache,
  getRows,
}: {
  selection: Ref<CellRange>
  activeCell: Ref<{ row: number; column: number; path: Array<number> }>
  canvasRef: Ref<HTMLCanvasElement>
  isFillMode: Ref<boolean>
  isAiFillMode: Ref<boolean>
  getFillHandlerPosition: () => FillHandlerPosition | null
  triggerReRender: () => void
  columns: ComputedRef<CanvasGridColumn[]>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  meta: Ref<TableType>
  isPasteable: (row: Row, column: ColumnType) => boolean
  elementMap: CanvasElement
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
  getRows: (start: number, end: number, path?: Array<number>) => Promise<Row[]>
}) {
  const { isMysql, isPg } = useBase()

  const { $api } = useNuxtApp()

  const { appInfo } = useGlobal()

  const fillStartRange = ref<CellRange | null>(null)

  const isFillEnded = ref(false)

  const selectRangeMap = computed(() => {
    const map: Record<string, boolean> = {}

    map[`${activeCell.value.row}-${activeCell.value.column}`] = true

    if (selection.value._start === null || selection.value._end === null) {
      return map
    }

    if (isFillMode.value && fillStartRange.value) {
      const startRow = Math.min(fillStartRange.value.start.row, selection.value._start.row)
      const endRow = Math.max(fillStartRange.value.end.row, selection.value._start.row)
      const startCol = Math.min(fillStartRange.value.start.col, selection.value._start.col)
      const endCol = Math.max(fillStartRange.value.end.col, selection.value._start.col)

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          map[`${row}-${col}`] = true
        }
      }
    } else {
      // Normal selection behavior
      for (let row = selection.value.start.row; row <= selection.value.end.row; row++) {
        for (let col = selection.value.start.col; col <= selection.value.end.col; col++) {
          map[`${row}-${col}`] = true
        }
      }
    }

    return map
  })

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
      if (selection.value.isSingleCell()) {
        selection.value.startRange({
          row: activeCell.value.row,
          col: activeCell.value.column,
        })
      }

      fillStartRange.value = new CellRange()

      fillStartRange.value.startRange({
        row: selection.value.start.row,
        col: selection.value.start.col,
      })

      fillStartRange.value.endRange({
        row: selection.value.end.row,
        col: selection.value.end.col,
      })
    }

    triggerReRender()
  }

  const handleFillMove = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    if (!isFillMode.value || isFillEnded.value) return

    const element = elementMap.findElementAt(0, e.clientY - rect.top, ElementTypes.ROW)

    if (!element) return

    selection.value.endRange({
      row: element.rowIndex,
      col: selection.value.end.col ?? fillStartRange.value?.end.col,
    })

    triggerReRender()
  }

  const handleFillEnd = async () => {
    if (isFillMode.value) {
      try {
        isFillEnded.value = true
        const localAiMode = Boolean(isAiFillMode.value)

        const groupPath = activeCell.value?.path

        const { cachedRows } = getDataCache(groupPath)

        if (fillStartRange.value === null) return

        if (selection.value._start !== null && selection.value._end !== null) {
          const tempActiveCell = { row: selection.value._start.row, col: selection.value._start.col }

          let startRow, endRow

          if (fillStartRange.value) {
            startRow = Math.min(fillStartRange.value.start.row, selection.value._start!.row)
            endRow = Math.max(fillStartRange.value.end.row, selection.value._start!.row)
          } else {
            startRow = selection.value.start.row
            endRow = selection.value.end.row
          }

          const cprows = await getRows(startRow, endRow, groupPath)

          const _cpcols = unref(columns).slice(selection.value.start.col, selection.value.end.col + 1) // slice the selected cols for copy

          const cpcols = _cpcols.map((col) => col.columnObj)

          const rawMatrix = serializeRange(cprows, cpcols, {
            isPg,
            isMysql,
            meta: unref(meta),
          }).json

          const fillDirection = selection.value._start.row <= selection.value._end.row ? 1 : -1

          let fillIndex = fillDirection === 1 ? 0 : rawMatrix.length - 1

          const rowsToPaste: Row[] = []
          const rowsToFill: Row[] = []
          const propsToPaste: string[] = []
          const propsToFill: string[] = []

          for (
            let row = selection.value._start.row;
            fillDirection === 1 ? row <= selection.value._end.row : row >= selection.value._end.row;
            row += fillDirection
          ) {
            const rowObj = (unref(cachedRows) as Map<number, Row>).get(row)

            if (!rowObj) {
              continue
            }

            let pasteIndex = 0

            if (!selectRangeMap.value[`${row}-${selection.value.start.col}`]) {
              rowsToPaste.push(rowObj)
            }

            for (let col = selection.value.start.col; col <= selection.value.end.col; col++) {
              const _col = unref(columns)[col]
              const colObj = _col?.columnObj

              if (!colObj) {
                pasteIndex++
                continue
              }

              if (!isPasteable(rowObj, colObj)) {
                pasteIndex++
                continue
              }

              // if the column is added only for the fill operation, don't paste the value
              if (
                selection.value._start &&
                selection.value._end &&
                selection.value._start.col <= col &&
                col <= selection.value._end.col
              ) {
                if (cpcols.findIndex((c) => c.id === colObj.id) === -1) {
                  if (!propsToFill.includes(colObj.title!)) propsToPaste.push(colObj.title!)
                }

                if (!propsToPaste.includes(colObj.title!) && !propsToFill.includes(colObj.title!))
                  propsToPaste.push(colObj.title!)
                let pasteValue

                try {
                  pasteValue = convertCellData(
                    {
                      value: rawMatrix[fillIndex]?.[pasteIndex],
                      to: colObj.uidt as UITypes,
                      column: colObj,
                      appInfo: unref(appInfo),
                    },
                    isMysql(meta.value?.source_id),
                    true,
                  )
                } catch (ex) {
                  if (ex instanceof ComputedTypePasteError) {
                    throw ex
                  }

                  pasteValue = null
                }

                if (pasteValue !== undefined) {
                  if (!localAiMode) rowObj.row[colObj.title!] = pasteValue
                }
              } else {
                if (localAiMode) {
                  propsToFill.push(colObj.title!)

                  if (
                    !rowsToFill.find(
                      (r) =>
                        extractPkFromRow(r.row, meta.value?.columns as ColumnType[]) ===
                        extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]),
                    )
                  ) {
                    rowsToFill.push(rowObj)
                  }
                }
              }

              pasteIndex++
            }

            if (fillDirection === 1) {
              fillIndex = fillIndex < rawMatrix.length - 1 ? fillIndex + 1 : 0
            } else {
              fillIndex = fillIndex >= 1 ? fillIndex - 1 : rawMatrix.length - 1
            }
          }

          if (localAiMode) {
            const sampleRows = cprows.map((row) => {
              const sampleRow: Record<string, any> = {
                Id: extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
              }

              for (const prop of propsToPaste) {
                sampleRow[prop] = row.row[prop]
              }

              for (const prop of propsToFill) {
                sampleRow[prop] = 'FILL'
              }

              return sampleRow
            })

            const generateIds = rowsToPaste.map((row) => extractPkFromRow(row.row, meta.value?.columns as ColumnType[]))

            $api.ai
              .dataFill(meta.value?.id, {
                rows: sampleRows,
                generateIds,
                numRows: generateIds.length,
              })
              .then((r: Record<string, any>[]) => {
                if (selection.value._start === null || selection.value._end === null) return

                for (const row of rowsToPaste.concat(rowsToFill)) {
                  const generatedRow = r.find(
                    (genRow) =>
                      extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) ===
                      extractPkFromRow(genRow, meta.value?.columns as ColumnType[]),
                  )

                  if (!generatedRow) continue

                  for (const prop of propsToPaste.concat(propsToFill)) {
                    row.row[prop] = generatedRow[prop]
                  }
                }

                bulkUpdateRows?.(
                  rowsToPaste.concat(rowsToFill),
                  propsToPaste.concat(propsToFill),
                  undefined,
                  undefined,
                  groupPath,
                ).then(() => {
                  activeCell.value.column = tempActiveCell.col
                  activeCell.value.row = tempActiveCell.row
                  fillStartRange.value = null
                  isFillMode.value = false
                })
              })
              .catch((_e) => {
                selection.value.clear()
                fillStartRange.value = null
                isFillMode.value = false
              })
            return
          }

          bulkUpdateRows?.(rowsToPaste, propsToPaste, undefined, undefined, groupPath).then(() => {
            activeCell.value.column = tempActiveCell.col
            activeCell.value.row = tempActiveCell.row
            activeCell.value.path = groupPath
            fillStartRange.value = null
            isFillMode.value = false
          })
        } else {
          fillStartRange.value = null
          isFillMode.value = false
        }
      } catch (error) {
        if (error instanceof TypeConversionError !== true || !(error as SuppressedError).isErrorSuppressed) {
          console.error(error, (error as SuppressedError).isErrorSuppressed)
          message.error(error?.message || 'Something went wrong')
        }
      }
    }
  }

  return {
    getFillHandlerPosition,
    handleFillStart,
    handleFillMove,
    handleFillEnd,
  }
}
