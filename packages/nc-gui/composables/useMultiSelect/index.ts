import dayjs from 'dayjs'
import type { MaybeRef } from '@vueuse/core'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { parse } from 'papaparse'
import type { Cell } from './cellRange'
import { CellRange } from './cellRange'
import convertCellData from './convertCellData'
import type { Nullable, Row } from '~/lib'
import {
  dateFormats,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  isDrawerOrModalExist,
  isMac,
  isTypableInputColumn,
  message,
  reactive,
  ref,
  timeFormats,
  unref,
  useCopy,
  useEventListener,
  useGlobal,
  useI18n,
  useMetas,
  useProject,
  useUIPermission,
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
  clearCell: Function,
  makeEditable: Function,
  scrollToActiveCell?: (row?: number | null, col?: number | null) => void,
  keyEventHandler?: Function,
  syncCellData?: Function,
  bulkUpdateRows?: Function,
) {
  const meta = ref(_meta)

  const tbodyEl = ref<HTMLElement>()

  const { t } = useI18n()

  const { copy } = useCopy()

  const { getMeta } = useMetas()

  const { appInfo } = useGlobal()

  const { isMysql } = useProject()

  const editEnabled = ref(_editEnabled)

  let isMouseDown = $ref(false)

  const selectedRange = reactive(new CellRange())

  const activeCell = reactive<Nullable<Cell>>({ row: null, col: null })

  const columnLength = $computed(() => unref(fields)?.length)

  const isCellActive = computed(
    () => !(activeCell.row === null || activeCell.col === null || isNaN(activeCell.row) || isNaN(activeCell.col)),
  )

  const { isUIAllowed } = useUIPermission()
  const hasEditPermission = $computed(() => isUIAllowed('xcDatatableEditable'))

  function makeActive(row: number, col: number) {
    if (activeCell.row === row && activeCell.col === col) {
      return
    }

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
    }

    if (columnObj.uidt === UITypes.Formula) {
      textToCopy = textToCopy.replace(/\b(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})\b/g, (d: string) => {
        // TODO(timezone): retrieve the format from the corresponding column meta
        // assume hh:mm at this moment
        return dayjs(d).utc().local().format('YYYY-MM-DD HH:mm')
      })
    }

    if (columnObj.uidt === UITypes.DateTime || columnObj.uidt === UITypes.Time) {
      // remove `"`
      // e.g. "2023-05-12T08:03:53.000Z" -> 2023-05-12T08:03:53.000Z
      textToCopy = textToCopy.replace(/["']/g, '')

      const isMySQL = isMysql(columnObj.base_id)

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
      textToCopy = d.format(
        columnObj.uidt === UITypes.DateTime ? constructDateTimeFormat(columnObj) : constructTimeFormat(columnObj),
      )

      if (columnObj.uidt === UITypes.DateTime && !dayjs(textToCopy).isValid()) {
        throw new Error('Invalid DateTime')
      }
    }

    if (columnObj.uidt === UITypes.LongText) {
      textToCopy = `"${textToCopy.replace(/\"/g, '""')}"`
    }

    return textToCopy
  }

  const copyTable = async (rows: Row[], cols: ColumnType[]) => {
    let copyHTML = '<table>'
    let copyPlainText = ''

    rows.forEach((row, i) => {
      let copyRow = '<tr>'
      cols.forEach((col, i) => {
        const value = valueToCopy(row, col)
        copyRow += `<td>${value}</td>`
        copyPlainText = `${copyPlainText}${value}${cols.length - 1 !== i ? '\t' : ''}`
      })
      copyHTML += `${copyRow}</tr>`
      if (rows.length - 1 !== i) {
        copyPlainText = `${copyPlainText}\n`
      }
    })
    copyHTML += '</table>'

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

  function handleMouseOver(row: number, col: number) {
    if (!isMouseDown) {
      return
    }
    selectedRange.endRange({ row, col })
  }

  function isCellSelected(row: number, col: number) {
    if (activeCell.col === col && activeCell.row === row) {
      return true
    }

    if (selectedRange.start === null || selectedRange.end === null) {
      return false
    }

    return (
      col >= selectedRange.start.col &&
      col <= selectedRange.end.col &&
      row >= selectedRange.start.row &&
      row <= selectedRange.end.row
    )
  }

  function handleMouseDown(event: MouseEvent, row: number, col: number) {
    // if there was a right click on selected range, don't restart the selection
    if (event?.button !== MAIN_MOUSE_PRESSED && isCellSelected(row, col)) {
      return
    }

    isMouseDown = true
    selectedRange.startRange({ row, col })
  }

  const handleCellClick = (event: MouseEvent, row: number, col: number) => {
    isMouseDown = true
    selectedRange.startRange({ row, col })
    selectedRange.endRange({ row, col })
    makeActive(row, col)
    scrollToActiveCell?.()
    isMouseDown = false
  }

  const handleMouseUp = (event: MouseEvent) => {
    // timeout is needed, because we want to set cell as active AFTER all the child's click handler's called
    // this is needed e.g. for date field edit, where two clicks had to be done - one to select cell, and another one to open date dropdown
    setTimeout(() => {
      makeActive(selectedRange.start.row, selectedRange.start.col)
    }, 0)

    // if the editEnabled is false, prevent selecting text on mouseUp
    if (!unref(editEnabled)) {
      event.preventDefault()
    }

    isMouseDown = false
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    // invoke the keyEventHandler if provided and return if it returns true
    if (await keyEventHandler?.(e)) {
      return true
    }

    if (!isCellActive.value) {
      return
    }

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
            activeCell.col = unref(columnLength) - 1
            editEnabled.value = false
          }
        } else {
          if (activeCell.col < unref(columnLength) - 1) {
            activeCell.col++
            editEnabled.value = false
          } else if (activeCell.row < unref(data).length - 1) {
            activeCell.row++
            activeCell.col = 0
            editEnabled.value = false
          }
        }
        scrollToActiveCell?.()
        break
      /** on enter key press make cell editable */
      case 'Enter':
        e.preventDefault()
        selectedRange.clear()

        makeEditable(unref(data)[activeCell.row], unref(fields)[activeCell.col])
        break
      /** on delete key press clear cell */
      case 'Delete':
        e.preventDefault()
        selectedRange.clear()

        await clearCell(activeCell as { row: number; col: number })
        break
      /** on arrow key press navigate through cells */
      case 'ArrowRight':
        e.preventDefault()
        selectedRange.clear()

        if (activeCell.col < unref(columnLength) - 1) {
          activeCell.col++
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        selectedRange.clear()

        if (activeCell.col > 0) {
          activeCell.col--
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        selectedRange.clear()

        if (activeCell.row > 0) {
          activeCell.row--
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        selectedRange.clear()

        if (activeCell.row < unref(data).length - 1) {
          activeCell.row++
          scrollToActiveCell?.()
          editEnabled.value = false
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
            }
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
    if (isDrawerOrModalExist()) {
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

    const clipboardData = e.clipboardData?.getData('text/plain') || ''

    const rowObj = unref(data)[activeCell.row]
    const columnObj = unref(fields)[activeCell.col]

    try {
      if (clipboardData?.includes('\n') || clipboardData?.includes('\t')) {
        // if the clipboard data contains new line or tab, then it is a matrix or LongText
        const parsedClipboard = parse(clipboardData, { delimiter: '\t' })

        if (parsedClipboard.errors.length > 0) {
          throw new Error(parsedClipboard.errors[0].message)
        }

        const clipboardMatrix = parsedClipboard.data as string[][]

        const pasteMatrixRows = clipboardMatrix.length
        const pasteMatrixCols = clipboardMatrix[0].length

        const colsToPaste = unref(fields).slice(activeCell.col, activeCell.col + pasteMatrixCols)
        const rowsToPaste = unref(data).slice(activeCell.row, activeCell.row + pasteMatrixRows)
        const propsToPaste: string[] = []

        for (let i = 0; i < pasteMatrixRows; i++) {
          const pasteRow = rowsToPaste[i]
          for (let j = 0; j < pasteMatrixCols; j++) {
            const pasteCol = colsToPaste[j]

            if (!pasteRow || !pasteCol) {
              continue
            }

            // skip pasting virtual columns for now
            if (isVirtualCol(pasteCol)) {
              continue
            }

            propsToPaste.push(pasteCol.title!)

            pasteRow.row[pasteCol.title!] = convertCellData(
              {
                value: clipboardMatrix[i][j],
                to: pasteCol.uidt as UITypes,
                column: pasteCol,
                appInfo: unref(appInfo),
              },
              isMysql(meta.value?.base_id),
            )
          }
        }
        await bulkUpdateRows?.(rowsToPaste, propsToPaste)
      } else {
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
            isMysql(meta.value?.base_id),
          )

          const foreignKeyColumn = meta.value?.columns?.find(
            (column: ColumnType) => column.id === (columnObj.colOptions as LinkToAnotherRecordType)?.fk_child_column_id,
          )

          const relatedTableMeta = await getMeta((columnObj.colOptions as LinkToAnotherRecordType).fk_related_model_id!)

          if (!foreignKeyColumn) return

          rowObj.row[foreignKeyColumn.title!] = extractPkFromRow(clipboardContext, (relatedTableMeta as any)!.columns!)

          return await syncCellData?.({ ...activeCell, updatedColumnTitle: foreignKeyColumn.title })
        }

        // if it's a virtual column excluding belongs to cell type skip paste
        if (isVirtualCol(columnObj)) {
          return message.info(t('msg.info.pasteNotSupported'))
        }

        rowObj.row[columnObj.title!] = convertCellData(
          {
            value: clipboardData,
            to: columnObj.uidt as UITypes,
            column: columnObj,
            appInfo: unref(appInfo),
          },
          isMysql(meta.value?.base_id),
        )

        await syncCellData?.(activeCell)
      }
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  useEventListener(document, 'keydown', handleKeyDown)
  useEventListener(tbodyEl, 'mouseup', handleMouseUp)
  useEventListener(document, 'paste', handlePaste)

  return {
    isCellActive,
    handleMouseDown,
    handleMouseOver,
    clearSelectedRange,
    copyValue,
    isCellSelected,
    activeCell,
    handleCellClick,
    tbodyEl,
    resetSelectedRange,
    selectedRange,
    makeActive,
  }
}
