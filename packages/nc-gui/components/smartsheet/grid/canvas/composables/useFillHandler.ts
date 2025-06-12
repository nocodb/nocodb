import { type ColumnType, type TableType, UITypes, type ViewType } from 'nocodb-sdk'
import { ColumnHelper, ComputedTypePasteError, TypeConversionError } from 'nocodb-sdk'
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

  const v2HandleFillValue = async ({
    rawMatrix,
    cpCols,
    rowToPaste,
  }: {
    rawMatrix: string[][]
    cpCols: (ColumnType & {
      extra?: any | never
    })[]
    rowToPaste: { start: number; end: number }
  }) => {
    if (rawMatrix.length === 0) return
    const direction = rowToPaste.end - rowToPaste.start > 0 ? 1 : -1
    // reverse if going up
    const rawMatrixFromDirection = direction === -1 ? rawMatrix.reverse() : rawMatrix
    // we transform from rows to cols based
    const rawMatrixTransposed = rawMatrixFromDirection[0]!.map((_, colIndex) =>
      rawMatrixFromDirection.map((row) => row[colIndex]),
    )
    const fillValuesByCols: any[][] = []
    const numberOfRows = Math.abs(rowToPaste.end - rowToPaste.start) + 1

    for (const [i, rowsOfCol] of rawMatrixTransposed.entries()) {
      const cpCol = cpCols[i]
      const populatedFillHandle = ColumnHelper.populateFillHandle({
        column: cpCol!,
        highlightedData: rowsOfCol,
        numberOfRows,
      })
      if (populatedFillHandle) {
        fillValuesByCols.push(populatedFillHandle)
      }
      // TODO: else, but should not happen
    }

    // apply the populated fill handle to rows
    // maybe TODO: extract to other function
    const rowsToPaste: Row[] = []
    const groupPath = activeCell.value?.path
    const { cachedRows } = getDataCache(groupPath)
    let incrementIndex = 0
    for (
      let rowIndex = rowToPaste.start + direction * rawMatrix.length;
      direction === 1 ? rowIndex <= rowToPaste.end : rowIndex >= rowToPaste.end;
      // Increment/decrement row counter based on fill direction
      rowIndex += direction
    ) {
      const rowObj = (unref(cachedRows) as Map<number, Row>).get(rowIndex)
      if (rowObj) {
        for (const [colIndex, cpCol] of cpCols.entries()) {
          const pasteValue = convertCellData(
            {
              value: fillValuesByCols[colIndex!]![incrementIndex],
              to: cpCol.uidt as UITypes,
              column: cpCol,
              appInfo: unref(appInfo),
            },
            isMysql(meta.value?.source_id),
            true,
          )
          rowObj.row[cpCol.title] = pasteValue
        }
        rowsToPaste.push(rowObj)
      }
      incrementIndex++
    }

    // If not in AI fill mode, perform a regular bulk update
    await bulkUpdateRows?.(
      rowsToPaste,
      cpCols.map((k) => k.title!),
      undefined,
      undefined,
      groupPath,
    )
  }

  const handleFillEnd = async () => {
    // Check if fill mode is currently active
    if (isFillMode.value) {
      try {
        // Indicate that the fill operation has ended
        isFillEnded.value = true
        // Determine if AI fill mode is enabled
        const localAiMode = Boolean(isAiFillMode.value)

        // Get the current group path from the active cell
        const groupPath = activeCell.value?.path

        // Retrieve cached rows for the current group path
        const { cachedRows } = getDataCache(groupPath)

        // If the fill start range is null, exit the function
        if (fillStartRange.value === null) return

        // Check if both start and end points of the selection are defined
        if (selection.value._start !== null && selection.value._end !== null) {
          // Store the active cell's position temporarily
          const tempActiveCell = { row: selection.value._start.row, col: selection.value._start.col }

          let startRow, endRow

          // need to handle cols not covered by selection too
          const startRangeLeftMost = Math.min(
            fillStartRange.value.start.col,
            fillStartRange.value.end.col,
            selection.value._start.col,
            selection.value._end.col,
          )
          const startRangeRightMost = Math.max(
            fillStartRange.value.start.col,
            fillStartRange.value.end.col,
            selection.value._start.col,
            selection.value._end.col,
          )
          // Determine the actual start and end rows for the fill operation
          if (fillStartRange.value) {
            startRow = Math.min(fillStartRange.value.start.row, selection.value._start!.row)
            endRow = Math.max(fillStartRange.value.end.row, selection.value._start!.row)
          } else {
            // Fallback to normal selection range if fillStartRange is not set
            startRow = selection.value.start.row
            endRow = selection.value.end.row
          }

          // Fetch the rows within the determined range
          const cprows = await getRows(startRow, endRow, groupPath)

          // Slice the selected columns for copying
          const _cpcols = unref(columns).slice(startRangeLeftMost, startRangeRightMost + 1)

          // Map to column objects
          const cpcols = _cpcols.map((col) => col.columnObj)
          // Serialize the range into a raw matrix (JSON format)
          const rawMatrix = serializeRange(
            cprows,
            cpcols,
            {
              isPg,
              isMysql,
              meta: unref(meta),
            },
            {
              skipUidt: [UITypes.Percent, UITypes.Currency],
            },
          ).json

          // Determine the direction of the fill operation (1 for downwards, -1 for upwards)
          const fillDirection = selection.value._start.row <= selection.value._end.row ? 1 : -1

          const startRangeBottomMost = Math.max(fillStartRange.value.start.row, fillStartRange.value.end.row)
          const startRangeTopMost = Math.min(fillStartRange.value.start.row, fillStartRange.value.end.row)

          // if not localAiMode, use the new v2 handle fill logic
          if (!localAiMode) {
            await v2HandleFillValue({
              rawMatrix,
              cpCols: cpcols,
              rowToPaste: {
                start:
                  fillDirection === 1
                    ? Math.min(startRangeTopMost, selection.value._start.row)
                    : Math.max(startRangeBottomMost, selection.value._start.row),
                end:
                  fillDirection === 1
                    ? Math.max(startRangeBottomMost, selection.value._end.row)
                    : Math.min(startRangeTopMost, selection.value._end.row),
              },
            })

            // Reset active cell, fill range, and fill mode after successful update
            activeCell.value.column = tempActiveCell.col
            activeCell.value.row = tempActiveCell.row
            activeCell.value.path = groupPath
            fillStartRange.value = null
            isFillMode.value = false
            return
          }

          // TODO: remove non-localAiMode logic
          // Initialize the fill index based on the fill direction
          let fillIndex = fillDirection === 1 ? 0 : rawMatrix.length - 1

          // Arrays to store rows and properties for pasting and AI filling
          const rowsToPaste: Row[] = []
          const rowsToFill: Row[] = []
          const propsToPaste: string[] = []
          const propsToFill: string[] = []

          // Loop through the selected rows based on fill direction
          for (
            // Initialize row counter
            let row = selection.value._start.row;
            // Condition for continuing the loop based on fill direction
            fillDirection === 1 ? row <= selection.value._end.row : row >= selection.value._end.row;
            // Increment/decrement row counter based on fill direction
            row += fillDirection
          ) {
            // Get the row object from cached rows
            const rowObj = (unref(cachedRows) as Map<number, Row>).get(row)

            // Skip if row object is not found
            if (!rowObj) {
              continue
            }

            // Initialize paste index for the current row
            let pasteIndex = 0

            // If the current cell is not part of the initial selection range, add the row to rowsToPaste
            if (!selectRangeMap.value[`${row}-${selection.value.start.col}`]) {
              rowsToPaste.push(rowObj)
            }

            // Loop through the selected columns
            for (let col = selection.value.start.col; col <= selection.value.end.col; col++) {
              // Get the column object
              const _col = unref(columns)[col]
              const colObj = _col?.columnObj

              // Skip if column object is not found
              if (!colObj) {
                pasteIndex++
                continue
              }

              // Skip if the cell is not pasteable
              if (!isPasteable(rowObj, colObj)) {
                pasteIndex++
                continue
              }

              // if the column is added only for the fill operation, don't paste the value
              // Check if the current column is within the selection range
              if (
                selection.value._start &&
                selection.value._end &&
                selection.value._start.col <= col &&
                col <= selection.value._end.col
              ) {
                // If column is not found in copied columns, add its title to propsToPaste if not already present in propsToFill
                if (cpcols.findIndex((c) => c.id === colObj.id) === -1) {
                  if (!propsToFill.includes(colObj.title!)) propsToPaste.push(colObj.title!)
                }

                // Add column title to propsToPaste if not already present in propsToPaste or propsToFill
                if (!propsToPaste.includes(colObj.title!) && !propsToFill.includes(colObj.title!))
                  propsToPaste.push(colObj.title!)
                let pasteValue

                try {
                  // Convert cell data for pasting
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
                  // Re-throw if it's a ComputedTypePasteError
                  if (ex instanceof ComputedTypePasteError) {
                    throw ex
                  }

                  // Set paste value to null for other errors
                  pasteValue = null
                }

                // If a valid paste value exists and not in AI mode, assign it to the row object
                if (pasteValue !== undefined) {
                  if (!localAiMode) rowObj.row[colObj.title!] = pasteValue
                }
              } else {
                // If in AI fill mode and column is outside selection range
                if (localAiMode) {
                  // Add column title to propsToFill
                  propsToFill.push(colObj.title!)

                  // Add row to rowsToFill if not already present
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

              // Increment paste index
              pasteIndex++
            }

            // Update fill index based on fill direction (cycle through rawMatrix)
            if (fillDirection === 1) {
              fillIndex = fillIndex < rawMatrix.length - 1 ? fillIndex + 1 : 0
            } else {
              fillIndex = fillIndex >= 1 ? fillIndex - 1 : rawMatrix.length - 1
            }
          }

          // If in AI fill mode, perform AI data filling
          if (localAiMode) {
            // Prepare sample rows for AI data fill API
            const sampleRows = cprows.map((row) => {
              const sampleRow: Record<string, any> = {
                Id: extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
              }

              // Add properties to paste from the original row
              for (const prop of propsToPaste) {
                sampleRow[prop] = row.row[prop]
              }

              // Mark properties to fill as 'FILL'
              for (const prop of propsToFill) {
                sampleRow[prop] = 'FILL'
              }

              return sampleRow
            })

            // Generate IDs for rows to paste
            const generateIds = rowsToPaste.map((row) => extractPkFromRow(row.row, meta.value?.columns as ColumnType[]))

            // Call the AI data fill API
            $api.ai
              .dataFill(meta.value?.id, {
                rows: sampleRows,
                generateIds,
                numRows: generateIds.length,
              })
              .then((r: Record<string, any>[]) => {
                // If selection start or end is null, exit
                if (selection.value._start === null || selection.value._end === null) return

                // Iterate through rows to paste and fill
                for (const row of rowsToPaste.concat(rowsToFill)) {
                  // Find the generated row from the API response
                  const generatedRow = r.find(
                    (genRow) =>
                      extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) ===
                      extractPkFromRow(genRow, meta.value?.columns as ColumnType[]),
                  )

                  // Skip if no generated row is found
                  if (!generatedRow) continue

                  // Update row properties with generated values
                  for (const prop of propsToPaste.concat(propsToFill)) {
                    row.row[prop] = generatedRow[prop]
                  }
                }

                // Perform bulk update of rows with generated data
                bulkUpdateRows?.(
                  rowsToPaste.concat(rowsToFill),
                  propsToPaste.concat(propsToFill),
                  undefined,
                  undefined,
                  groupPath,
                ).then(() => {
                  // Reset active cell, fill range, and fill mode after successful update
                  activeCell.value.column = tempActiveCell.col
                  activeCell.value.row = tempActiveCell.row
                  fillStartRange.value = null
                  isFillMode.value = false
                })
              })
              .catch((_e) => {
                // Clear selection, fill range, and fill mode on error
                selection.value.clear()
                fillStartRange.value = null
                isFillMode.value = false
              })
            return
          }

          // If not in AI fill mode, perform a regular bulk update
          bulkUpdateRows?.(rowsToPaste, propsToPaste, undefined, undefined, groupPath).then(() => {
            // Reset active cell, fill range, and fill mode after successful update
            activeCell.value.column = tempActiveCell.col
            activeCell.value.row = tempActiveCell.row
            activeCell.value.path = groupPath
            fillStartRange.value = null
            isFillMode.value = false
          })
        } else {
          // If selection is invalid, reset fill range and fill mode
          fillStartRange.value = null
          isFillMode.value = false
        }
      } catch (error) {
        // Handle errors during the fill operation
        // If the error is not a suppressed TypeConversionError, log it and show a message
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
