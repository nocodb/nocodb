import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Ref } from 'vue'
import type { MaybeRef } from '@vueuse/core'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { parse } from 'papaparse'
import type { Cell } from './cellRange'
import { CellRange } from './cellRange'
import convertCellData from './convertCellData'
import type { Nullable, Row } from '#imports'
import {
  dateFormats,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  isDrawerOrModalExist,
  isExpandedCellInputExist,
  isMac,
  isTypableInputColumn,
  message,
  reactive,
  ref,
  timeFormats,
  unref,
  useBase,
  useCopy,
  useEventListener,
  useGlobal,
  useI18n,
  useMetas,
} from '#imports'

const MAIN_MOUSE_PRESSED = 0

/**
 * Utility to help with multi-selecting rows/cells in the smartsheet
 */
export function useMultiSelect(
  _meta: MaybeRef<TableType | undefined>,
  fields: MaybeRef<ColumnType[]>,
  data: MaybeRef<Row[]>,
  _editEnabled: MaybeRef<boolean>,
  isPkAvail: MaybeRef<boolean | undefined>,
  contextMenu: Ref<boolean>,
  clearCell: Function,
  clearSelectedRangeOfCells: Function,
  makeEditable: Function,
  scrollToCell?: (row?: number | null, col?: number | null) => void,
  keyEventHandler?: Function,
  syncCellData?: Function,
  bulkUpdateRows?: Function,
  fillHandle?: MaybeRef<HTMLElement | undefined>,
) {
  const meta = ref(_meta)

  const { t } = useI18n()

  const { copy } = useCopy()

  const { getMeta } = useMetas()

  const { appInfo } = useGlobal()

  const { isMysql, isPg } = useBase()

  const editEnabled = ref(_editEnabled)

  const isMouseDown = ref(false)

  const isFillMode = ref(false)

  const selectedRange = reactive(new CellRange())

  const fillRange = reactive(new CellRange())

  const activeCell = reactive<Nullable<Cell>>({ row: null, col: null })

  const columnLength = computed(() => unref(fields)?.length)

  const isCellActive = computed(
    () => !(activeCell.row === null || activeCell.col === null || isNaN(activeCell.row) || isNaN(activeCell.col)),
  )

  function makeActive(row: number, col: number) {
    if (activeCell.row === row && activeCell.col === col) {
      return
    }

    // disable edit mode if active cell is changed
    editEnabled.value = false

    activeCell.row = row
    activeCell.col = col
  }

  function constructDateTimeFormat(column: ColumnType) {
    const dateFormat = constructDateFormat(column)
    const timeFormat = constructTimeFormat(column)
    return `${dateFormat} ${timeFormat}`
  }

  function constructDateFormat(column: ColumnType) {
    return parseProp(column?.meta)?.date_format ?? dateFormats[0]
  }

  function constructTimeFormat(column: ColumnType) {
    return parseProp(column?.meta)?.time_format ?? timeFormats[0]
  }

  const valueToCopy = (rowObj: Row, columnObj: ColumnType) => {
    let textToCopy = (columnObj.title && rowObj.row[columnObj.title]) || ''

    if (columnObj.uidt === UITypes.Checkbox) {
      textToCopy = !!textToCopy
    }

    if (typeof textToCopy === 'object') {
      textToCopy = JSON.stringify(textToCopy)
    } else {
      textToCopy = textToCopy.toString()
    }

    if (columnObj.uidt === UITypes.Formula) {
      textToCopy = textToCopy.replace(/\b(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})\b/g, (d: string) => {
        // TODO(timezone): retrieve the format from the corresponding column meta
        // assume hh:mm at this moment
        return dayjs(d).utc().local().format('YYYY-MM-DD HH:mm')
      })
    }

    if (columnObj.uidt === UITypes.DateTime) {
      // remove `"`
      // e.g. "2023-05-12T08:03:53.000Z" -> 2023-05-12T08:03:53.000Z
      textToCopy = textToCopy.replace(/["']/g, '')

      const isMySQL = isMysql(columnObj.source_id)

      let d = dayjs(textToCopy)

      if (!d.isValid()) {
        // insert a datetime value, copy the value without refreshing
        // e.g. textToCopy = 2023-05-12T03:49:25.000Z
        // feed custom parse format
        d = dayjs(textToCopy, isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ')
      }

      // users can change the datetime format in UI
      // `textToCopy` would be always in YYYY-MM-DD HH:mm:ss(Z / +xx:yy) format
      // therefore, here we reformat to the correct datetime format based on the meta
      textToCopy = d.format(constructDateTimeFormat(columnObj))

      if (!dayjs(textToCopy).isValid()) {
        // return empty string for invalid datetime
        return ''
      }
    }

    if (columnObj.uidt === UITypes.Time) {
      // remove `"`
      // e.g. "2023-05-12T08:03:53.000Z" -> 2023-05-12T08:03:53.000Z
      textToCopy = textToCopy.replace(/["']/g, '')

      const isMySQL = isMysql(columnObj.source_id)
      const isPostgres = isPg(columnObj.source_id)

      let d = dayjs(textToCopy)

      if (!d.isValid()) {
        // insert a datetime value, copy the value without refreshing
        // e.g. textToCopy = 2023-05-12T03:49:25.000Z
        // feed custom parse format
        d = dayjs(textToCopy, isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ')
      }

      if (!d.isValid()) {
        // MySQL and Postgres store time in HH:mm:ss format so we need to feed custom parse format
        d = isMySQL || isPostgres ? dayjs(textToCopy, 'HH:mm:ss') : dayjs(textToCopy)
      }

      if (!d.isValid()) {
        // return empty string for invalid time
        return ''
      }

      textToCopy = d.format(constructTimeFormat(columnObj))
    }

    if (columnObj.uidt === UITypes.LongText) {
      textToCopy = `"${textToCopy.replace(/"/g, '\\"')}"`
    }

    return textToCopy
  }

  const serializeRange = (rows: Row[], cols: ColumnType[]) => {
    let html = '<table>'
    let text = ''
    const json: string[][] = []

    rows.forEach((row, i) => {
      let copyRow = '<tr>'
      const jsonRow: string[] = []
      cols.forEach((col, i) => {
        const value = valueToCopy(row, col)
        copyRow += `<td>${value}</td>`
        text = `${text}${value}${cols.length - 1 !== i ? '\t' : ''}`
        jsonRow.push(value)
      })
      html += `${copyRow}</tr>`
      if (rows.length - 1 !== i) {
        text = `${text}\n`
      }
      json.push(jsonRow)
    })
    html += '</table>'

    return { html, text, json }
  }

  const copyTable = async (rows: Row[], cols: ColumnType[]) => {
    const { html: copyHTML, text: copyPlainText } = serializeRange(rows, cols)

    const blobHTML = new Blob([copyHTML], { type: 'text/html' })
    const blobPlainText = new Blob([copyPlainText], { type: 'text/plain' })

    return navigator.clipboard.write([new ClipboardItem({ [blobHTML.type]: blobHTML, [blobPlainText.type]: blobPlainText })])
  }

  async function copyValue(ctx?: Cell) {
    try {
      if (selectedRange.start !== null && selectedRange.end !== null && !selectedRange.isSingleCell()) {
        const cprows = unref(data).slice(selectedRange.start.row, selectedRange.end.row + 1) // slice the selected rows for copy
        const cpcols = unref(fields).slice(selectedRange.start.col, selectedRange.end.col + 1) // slice the selected cols for copy

        await copyTable(cprows, cpcols)
        message.success(t('msg.info.copiedToClipboard'))
      } else {
        // if copy was called with context (right click position) - copy value from context
        // else if there is just one selected cell, copy it's value
        const cpRow = ctx?.row ?? activeCell.row
        const cpCol = ctx?.col ?? activeCell.col

        if (cpRow != null && cpCol != null) {
          const rowObj = unref(data)[cpRow]
          const columnObj = unref(fields)[cpCol]

          const textToCopy = valueToCopy(rowObj, columnObj)

          await copy(textToCopy)
          message.success(t('msg.info.copiedToClipboard'))
        }
      }
    } catch {
      message.error(t('msg.error.copyToClipboardError'))
    }
  }

  function isCellSelected(row: number, col: number) {
    if (activeCell.col === col && activeCell.row === row) {
      return true
    }

    return selectedRange.isCellInRange({ row, col })
  }

  function isCellInFillRange(row: number, col: number) {
    if (fillRange._start === null || fillRange._end === null) {
      return false
    }

    if (selectedRange.isCellInRange({ row, col })) {
      return false
    }

    return fillRange.isCellInRange({ row, col })
  }

  const isPasteable = (row?: Row, col?: ColumnType, showInfo = false) => {
    if (!row || !col) {
      if (showInfo) {
        message.info('Please select a cell to paste')
      }
      return false
    }

    // skip pasting virtual columns (including LTAR columns for now) and system columns
    if (isVirtualCol(col) || isSystemColumn(col)) {
      if (showInfo) {
        message.info(t('msg.info.pasteNotSupported'))
      }
      return false
    }

    // skip pasting auto increment columns
    if (col.ai) {
      if (showInfo) {
        message.info(t('msg.info.autoIncFieldNotEditable'))
      }
      return false
    }

    // skip pasting primary key columns
    if (col.pk && !row.rowMeta.new) {
      if (showInfo) {
        message.info(t('msg.info.editingPKnotSupported'))
      }
      return false
    }

    return true
  }

  function handleMouseOver(event: MouseEvent, row: number, col: number) {
    if (isFillMode.value) {
      const rw = unref(data)[row]

      if (!selectedRange._start || !selectedRange._end) return

      // fill is not supported for new rows yet
      if (rw.rowMeta.new) return

      fillRange.endRange({ row, col: selectedRange._end.col })
      scrollToCell?.(row, col)
      return
    }

    if (!isMouseDown.value) {
      return
    }

    // extend the selection and scroll to the cell
    selectedRange.endRange({ row, col })
    scrollToCell?.(row, col)

    // avoid selecting text
    event.preventDefault()
  }

  function handleMouseDown(event: MouseEvent, row: number, col: number) {
    // if there was a right click on selected range, don't restart the selection
    if (
      (event?.button !== MAIN_MOUSE_PRESSED || (event?.button === MAIN_MOUSE_PRESSED && event.ctrlKey)) &&
      isCellSelected(row, col)
    ) {
      return
    }

    // if edit is enabled, don't start the selection (some cells shrink after edit mode, which causes the selection to expand if flag is set)
    if (!editEnabled.value) isMouseDown.value = true

    contextMenu.value = false

    // avoid text selection
    event.preventDefault()

    // if shift key is pressed, extend the selection
    if (event.shiftKey) {
      // if shift key is pressed, don't restart the selection (unless there is no active cell)
      if (activeCell.col === null || activeCell.row === null) {
        selectedRange.startRange({ row, col })
      }

      selectedRange.endRange({ row, col })
      return
    }

    // start a new selection
    selectedRange.startRange({ row, col })

    if (activeCell.row !== row || activeCell.col !== col) {
      // clear active cell on selection start
      activeCell.row = null
      activeCell.col = null
    }
  }

  const handleCellClick = (event: MouseEvent, row: number, col: number) => {
    // if shift key is pressed, don't change the active cell (unless there is no active cell)
    if (!event.shiftKey || activeCell.col === null || activeCell.row === null) {
      makeActive(row, col)
    }

    scrollToCell?.(row, col)
  }

  const handleMouseUp = (_event: MouseEvent) => {
    if (isFillMode.value) {
      isFillMode.value = false

      if (fillRange._start === null || fillRange._end === null) return

      if (selectedRange._start !== null && selectedRange._end !== null) {
        const tempActiveCell = { row: selectedRange._start.row, col: selectedRange._start.col }

        const cprows = unref(data).slice(selectedRange.start.row, selectedRange.end.row + 1) // slice the selected rows for copy
        const cpcols = unref(fields).slice(selectedRange.start.col, selectedRange.end.col + 1) // slice the selected cols for copy

        const rawMatrix = serializeRange(cprows, cpcols).json

        const fillDirection = fillRange._start.row <= fillRange._end.row ? 1 : -1

        let fillIndex = fillDirection === 1 ? 0 : rawMatrix.length - 1

        const rowsToPaste: Row[] = []
        const propsToPaste: string[] = []

        for (
          let row = fillRange._start.row;
          fillDirection === 1 ? row <= fillRange._end.row : row >= fillRange._end.row;
          row += fillDirection
        ) {
          if (isCellSelected(row, selectedRange.start.col)) {
            continue
          }

          const rowObj = unref(data)[row]

          let pasteIndex = 0

          for (let col = fillRange.start.col; col <= fillRange.end.col; col++) {
            const colObj = unref(fields)[col]

            if (!isPasteable(rowObj, colObj)) {
              pasteIndex++
              continue
            }

            propsToPaste.push(colObj.title!)

            const pasteValue = convertCellData(
              {
                value: rawMatrix[fillIndex][pasteIndex],
                to: colObj.uidt as UITypes,
                column: colObj,
                appInfo: unref(appInfo),
              },
              isMysql(meta.value?.source_id),
              true,
            )

            if (pasteValue !== undefined) {
              rowObj.row[colObj.title!] = pasteValue
              rowsToPaste.push(rowObj)
            }

            pasteIndex++
          }

          if (fillDirection === 1) {
            fillIndex = fillIndex < rawMatrix.length - 1 ? fillIndex + 1 : 0
          } else {
            fillIndex = fillIndex >= 1 ? fillIndex - 1 : rawMatrix.length - 1
          }
        }

        bulkUpdateRows?.(rowsToPaste, propsToPaste).then(() => {
          if (fillRange._start === null || fillRange._end === null) return
          selectedRange.startRange(tempActiveCell)
          selectedRange.endRange(fillRange._end)
          makeActive(tempActiveCell.row, tempActiveCell.col)
          fillRange.clear()
        })
      } else {
        fillRange.clear()
      }
      return
    }

    if (isMouseDown.value) {
      isMouseDown.value = false
      // timeout is needed, because we want to set cell as active AFTER all the child's click handler's called
      // this is needed e.g. for date field edit, where two clicks had to be done - one to select cell, and another one to open date dropdown
      setTimeout(() => {
        if (selectedRange._start) {
          if (activeCell.row !== selectedRange._start.row || activeCell.col !== selectedRange._start.col) {
            makeActive(selectedRange._start.row, selectedRange._start.col)
          }
        }
      }, 0)
    }
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    // invoke the keyEventHandler if provided and return if it returns true
    if (await keyEventHandler?.(e)) {
      return true
    }

    if (!isCellActive.value || activeCell.row === null || activeCell.col === null) {
      return
    }

    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

    /** on tab key press navigate through cells */
    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        selectedRange.clear()

        if (e.shiftKey) {
          if (activeCell.col > 0) {
            activeCell.col--
            editEnabled.value = false
          } else if (activeCell.row > 0) {
            activeCell.row--
            activeCell.col = unref(columnLength.value) - 1
            editEnabled.value = false
          }
        } else {
          if (activeCell.col < unref(columnLength.value) - 1) {
            activeCell.col++
            editEnabled.value = false
          } else if (activeCell.row < unref(data).length - 1) {
            activeCell.row++
            activeCell.col = 0
            editEnabled.value = false
          }
        }
        scrollToCell?.()
        break
      /** on enter key press make cell editable */
      case 'Enter':
        e.preventDefault()
        selectedRange.clear()

        makeEditable(unref(data)[activeCell.row], unref(fields)[activeCell.col])
        break
      /** on delete key press clear cell */
      case 'Delete':
      case 'Backspace':
        e.preventDefault()

        if (selectedRange.isSingleCell()) {
          selectedRange.clear()

          await clearCell(activeCell as { row: number; col: number })
        } else {
          await clearSelectedRangeOfCells()
        }
        break
      /** on arrow key press navigate through cells */
      case 'ArrowRight':
        e.preventDefault()

        if (e.shiftKey) {
          if (cmdOrCtrl) {
            editEnabled.value = false
            selectedRange.endRange({
              row: selectedRange._end?.row ?? activeCell.row,
              col: unref(columnLength.value) - 1,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          } else if ((selectedRange._end?.col ?? activeCell.col) < unref(columnLength.value) - 1) {
            editEnabled.value = false
            selectedRange.endRange({
              row: selectedRange._end?.row ?? activeCell.row,
              col: (selectedRange._end?.col ?? activeCell.col) + 1,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          }
        } else {
          selectedRange.clear()

          if (activeCell.col < unref(columnLength.value) - 1) {
            activeCell.col++
            selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
            scrollToCell?.()
            editEnabled.value = false
          }
        }
        break
      case 'ArrowLeft':
        e.preventDefault()

        if (e.shiftKey) {
          if (cmdOrCtrl) {
            editEnabled.value = false
            selectedRange.endRange({
              row: selectedRange._end?.row ?? activeCell.row,
              col: 0,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          } else if ((selectedRange._end?.col ?? activeCell.col) > 0) {
            editEnabled.value = false
            selectedRange.endRange({
              row: selectedRange._end?.row ?? activeCell.row,
              col: (selectedRange._end?.col ?? activeCell.col) - 1,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          }
        } else {
          selectedRange.clear()

          if (activeCell.col > 0) {
            activeCell.col--
            selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
            scrollToCell?.()
            editEnabled.value = false
          }
        }
        break
      case 'ArrowUp':
        e.preventDefault()

        if (e.shiftKey) {
          if (cmdOrCtrl) {
            editEnabled.value = false
            selectedRange.endRange({
              row: 0,
              col: selectedRange._end?.col ?? activeCell.col,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          } else if ((selectedRange._end?.row ?? activeCell.row) > 0) {
            editEnabled.value = false
            selectedRange.endRange({
              row: (selectedRange._end?.row ?? activeCell.row) - 1,
              col: selectedRange._end?.col ?? activeCell.col,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          }
        } else {
          selectedRange.clear()

          if (activeCell.row > 0) {
            activeCell.row--
            selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
            scrollToCell?.()
            editEnabled.value = false
          }
        }
        break
      case 'ArrowDown':
        e.preventDefault()

        if (e.shiftKey) {
          if (cmdOrCtrl) {
            editEnabled.value = false
            selectedRange.endRange({
              row: unref(data).length - 1,
              col: selectedRange._end?.col ?? activeCell.col,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          } else if ((selectedRange._end?.row ?? activeCell.row) < unref(data).length - 1) {
            editEnabled.value = false
            selectedRange.endRange({
              row: (selectedRange._end?.row ?? activeCell.row) + 1,
              col: selectedRange._end?.col ?? activeCell.col,
            })
            scrollToCell?.(selectedRange._end?.row, selectedRange._end?.col)
          }
        } else {
          selectedRange.clear()

          if (activeCell.row < unref(data).length - 1) {
            activeCell.row++
            selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
            scrollToCell?.()
            editEnabled.value = false
          }
        }
        break
      default:
        {
          const rowObj = unref(data)[activeCell.row]
          const columnObj = unref(fields)[activeCell.col]

          if (
            (!unref(editEnabled) || !isTypableInputColumn(columnObj)) &&
            !isDrawerOrModalExist() &&
            (isMac() ? e.metaKey : e.ctrlKey)
          ) {
            switch (e.keyCode) {
              // copy - ctrl/cmd +c
              case 67:
                await copyValue()
                break
              // select all - ctrl/cmd +a
              case 65:
                selectedRange.startRange({ row: 0, col: 0 })
                selectedRange.endRange({ row: unref(data).length - 1, col: unref(columnLength.value) - 1 })
                break
            }
          }

          // Handle escape
          if (e.key === 'Escape') {
            selectedRange.clear()

            activeCell.col = null
            activeCell.row = null
          }

          if (unref(editEnabled) || e.ctrlKey || e.altKey || e.metaKey) {
            return true
          }

          /** on letter key press make cell editable and empty */
          if (e.key.length === 1) {
            if (!unref(isPkAvail) && !rowObj.rowMeta.new) {
              // Update not allowed for table which doesn't have primary Key
              return message.info(t('msg.info.updateNotAllowedWithoutPK'))
            }
            if (isTypableInputColumn(columnObj) && makeEditable(rowObj, columnObj) && columnObj.title) {
              rowObj.row[columnObj.title] = ''
            }
            // editEnabled = true
          }
        }
        break
    }
  }

  const resetSelectedRange = () => selectedRange.clear()

  const clearSelectedRange = selectedRange.clear.bind(selectedRange)

  const handlePaste = async (e: ClipboardEvent) => {
    if (isDrawerOrModalExist() || isExpandedCellInputExist()) {
      return
    }

    if (!isCellActive.value) {
      return
    }

    if (unref(editEnabled)) {
      return
    }

    if (activeCell.row === null || activeCell.row === undefined || activeCell.col === null || activeCell.col === undefined) {
      return
    }

    e.preventDefault()

    // Replace \" with " in clipboard data
    const clipboardData = e.clipboardData?.getData('text/plain') || ''

    try {
      if (clipboardData?.includes('\n') || clipboardData?.includes('\t')) {
        // if the clipboard data contains new line or tab, then it is a matrix or LongText
        const parsedClipboard = parse(clipboardData, { delimiter: '\t', escapeChar: '\\' })

        if (parsedClipboard.errors.length > 0) {
          throw new Error(parsedClipboard.errors[0].message)
        }

        const clipboardMatrix = parsedClipboard.data as string[][]

        const pasteMatrixRows = clipboardMatrix.length
        const pasteMatrixCols = clipboardMatrix[0].length

        const colsToPaste = unref(fields).slice(activeCell.col, activeCell.col + pasteMatrixCols)
        const rowsToPaste = unref(data).slice(activeCell.row, activeCell.row + pasteMatrixRows)
        const propsToPaste: string[] = []

        let pastedRows = 0

        for (let i = 0; i < pasteMatrixRows; i++) {
          const pasteRow = rowsToPaste[i]

          // TODO handle insert new row
          if (!pasteRow || pasteRow.rowMeta.new) break

          pastedRows++

          for (let j = 0; j < pasteMatrixCols; j++) {
            const pasteCol = colsToPaste[j]

            if (!isPasteable(pasteRow, pasteCol)) {
              continue
            }

            propsToPaste.push(pasteCol.title!)

            const pasteValue = convertCellData(
              {
                value: clipboardMatrix[i][j],
                to: pasteCol.uidt as UITypes,
                column: pasteCol,
                appInfo: unref(appInfo),
              },
              isMysql(meta.value?.source_id),
              true,
            )

            if (pasteValue !== undefined) {
              pasteRow.row[pasteCol.title!] = pasteValue
            }
          }
        }
        await bulkUpdateRows?.(rowsToPaste, propsToPaste)

        if (pastedRows > 0) {
          // highlight the pasted range
          selectedRange.startRange({ row: activeCell.row, col: activeCell.col })
          selectedRange.endRange({ row: activeCell.row + pastedRows - 1, col: activeCell.col + pasteMatrixCols - 1 })
        }
      } else {
        if (selectedRange.isSingleCell()) {
          const rowObj = unref(data)[activeCell.row]
          const columnObj = unref(fields)[activeCell.col]

          // handle belongs to column
          if (
            columnObj.uidt === UITypes.LinkToAnotherRecord &&
            (columnObj.colOptions as LinkToAnotherRecordType)?.type === RelationTypes.BELONGS_TO
          ) {
            const clipboardContext = JSON.parse(clipboardData!)

            rowObj.row[columnObj.title!] = convertCellData(
              {
                value: clipboardContext,
                to: columnObj.uidt as UITypes,
                column: columnObj,
                appInfo: unref(appInfo),
              },
              isMysql(meta.value?.source_id),
            )

            const foreignKeyColumn = meta.value?.columns?.find(
              (column: ColumnType) => column.id === (columnObj.colOptions as LinkToAnotherRecordType)?.fk_child_column_id,
            )

            const relatedTableMeta = await getMeta((columnObj.colOptions as LinkToAnotherRecordType).fk_related_model_id!)

            if (!foreignKeyColumn) return

            rowObj.row[foreignKeyColumn.title!] = extractPkFromRow(clipboardContext, (relatedTableMeta as any)!.columns!)

            return await syncCellData?.({ ...activeCell, updatedColumnTitle: foreignKeyColumn.title })
          }

          if (!isPasteable(rowObj, columnObj, true)) {
            return
          }

          const pasteValue = convertCellData(
            {
              value: clipboardData,
              to: columnObj.uidt as UITypes,
              column: columnObj,
              appInfo: unref(appInfo),
            },
            isMysql(meta.value?.source_id),
          )

          if (pasteValue !== undefined) {
            rowObj.row[columnObj.title!] = pasteValue
          }

          await syncCellData?.(activeCell)
        } else {
          const start = selectedRange.start
          const end = selectedRange.end

          const startRow = Math.min(start.row, end.row)
          const endRow = Math.max(start.row, end.row)
          const startCol = Math.min(start.col, end.col)
          const endCol = Math.max(start.col, end.col)

          const cols = unref(fields).slice(startCol, endCol + 1)
          const rows = unref(data).slice(startRow, endRow + 1)
          const props = []

          for (const row of rows) {
            // TODO handle insert new row
            if (!row || row.rowMeta.new) continue

            for (const col of cols) {
              if (!col.title) continue

              if (!isPasteable(row, col)) {
                continue
              }

              props.push(col.title)

              const pasteValue = convertCellData(
                {
                  value: clipboardData,
                  to: col.uidt as UITypes,
                  column: col,
                  appInfo: unref(appInfo),
                },
                isMysql(meta.value?.source_id),
                true,
              )

              if (pasteValue !== undefined) {
                row.row[col.title] = pasteValue
              }
            }
          }

          await bulkUpdateRows?.(rows, props)
        }
      }
    } catch (error: any) {
      console.error(error)
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  function fillHandleMouseDown(event: MouseEvent) {
    if (event?.button !== MAIN_MOUSE_PRESSED) {
      return
    }

    isFillMode.value = true

    if (selectedRange._start && selectedRange._end) {
      fillRange.startRange({ row: selectedRange._start?.row, col: selectedRange._start.col })
      fillRange.endRange({ row: selectedRange._end?.row, col: selectedRange._end.col })
    }

    event.preventDefault()
  }

  useEventListener(document, 'keydown', handleKeyDown)
  useEventListener(document, 'mouseup', handleMouseUp)
  useEventListener(document, 'paste', handlePaste)

  useEventListener(fillHandle, 'mousedown', fillHandleMouseDown)

  return {
    isCellActive,
    handleMouseDown,
    handleMouseOver,
    clearSelectedRange,
    copyValue,
    isCellSelected,
    activeCell,
    handleCellClick,
    resetSelectedRange,
    selectedRange,
    makeActive,
    isCellInFillRange,
    isMouseDown,
    isFillMode,
  }
}
