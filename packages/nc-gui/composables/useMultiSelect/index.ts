import type { MaybeRef } from '@vueuse/core'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Cell } from './cellRange'
import { CellRange } from './cellRange'
import convertCellData from './convertCellData'
import type { Nullable, Row } from '~/lib'
import {
  copyTable,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  isMac,
  isTypableInputColumn,
  message,
  reactive,
  ref,
  unref,
  useCopy,
  useEventListener,
  useI18n,
  useMetas,
  useProject,
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
) {
  const meta = ref(_meta)

  const { t } = useI18n()

  const { copy } = useCopy()

  const { getMeta } = useMetas()

  const { isMysql } = useProject()

  let clipboardContext = $ref<{ value: any; uidt: UITypes } | null>(null)

  const editEnabled = ref(_editEnabled)

  let isMouseDown = $ref(false)

  const selectedRange = reactive(new CellRange())

  const activeCell = reactive<Nullable<Cell>>({ row: null, col: null })

  const columnLength = $computed(() => unref(fields)?.length)

  const isCellActive = computed(
    () => !(activeCell.row === null || activeCell.col === null || isNaN(activeCell.row) || isNaN(activeCell.col)),
  )

  function makeActive(row: number, col: number) {
    if (activeCell.row === row && activeCell.col === col) {
      return
    }

    activeCell.row = row
    activeCell.col = col
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

          let textToCopy = (columnObj.title && rowObj.row[columnObj.title]) || ''

          if (columnObj.uidt === UITypes.Checkbox) {
            textToCopy = !!textToCopy
          }

          if (typeof textToCopy === 'object') {
            textToCopy = JSON.stringify(textToCopy)
          }
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

    editEnabled.value = false
    isMouseDown = true
    selectedRange.startRange({ row, col })
  }

  const handleCellClick = (event: MouseEvent, row: number, col: number) => {
    isMouseDown = true
    editEnabled.value = false
    selectedRange.startRange({ row, col })
    selectedRange.endRange({ row, col })
    makeActive(row, col)
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

          if ((!unref(editEnabled) || !isTypableInputColumn(columnObj)) && (isMac() ? e.metaKey : e.ctrlKey)) {
            switch (e.keyCode) {
              // copy - ctrl/cmd +c
              case 67:
                // set clipboard context only if single cell selected
                // or if selected range is empty
                if (selectedRange.isSingleCell() || (selectedRange.isEmpty() && rowObj && columnObj)) {
                  clipboardContext = {
                    value: rowObj.row[columnObj.title!],
                    uidt: columnObj.uidt as UITypes,
                  }
                } else {
                  clipboardContext = null
                }
                await copyValue()
                break
              // paste - ctrl/cmd + v
              case 86:
                try {
                  // handle belongs to column
                  if (
                    columnObj.uidt === UITypes.LinkToAnotherRecord &&
                    (columnObj.colOptions as LinkToAnotherRecordType)?.type === RelationTypes.BELONGS_TO
                  ) {
                    if (!clipboardContext || typeof clipboardContext.value !== 'object') {
                      return message.info('Invalid data')
                    }
                    rowObj.row[columnObj.title!] = convertCellData(
                      {
                        value: clipboardContext.value,
                        from: clipboardContext.uidt,
                        to: columnObj.uidt as UITypes,
                      },
                      isMysql(meta.value?.base_id),
                    )
                    e.preventDefault()

                    const foreignKeyColumn = meta.value?.columns?.find(
                      (column: ColumnType) => column.id === (columnObj.colOptions as LinkToAnotherRecordType)?.fk_child_column_id,
                    )

                    const relatedTableMeta = await getMeta((columnObj.colOptions as LinkToAnotherRecordType).fk_related_model_id!)

                    if (!foreignKeyColumn) return

                    rowObj.row[foreignKeyColumn.title!] = extractPkFromRow(
                      clipboardContext.value,
                      (relatedTableMeta as any)!.columns!,
                    )

                    return await syncCellData?.({ ...activeCell, updatedColumnTitle: foreignKeyColumn.title })
                  }

                  // if it's a virtual column excluding belongs to cell type skip paste
                  if (isVirtualCol(columnObj)) {
                    return message.info(t('msg.info.pasteNotSupported'))
                  }

                  if (clipboardContext) {
                    rowObj.row[columnObj.title!] = convertCellData(
                      {
                        value: clipboardContext.value,
                        from: clipboardContext.uidt,
                        to: columnObj.uidt as UITypes,
                      },
                      isMysql(meta.value?.base_id),
                    )
                    e.preventDefault()
                    syncCellData?.(activeCell)
                  } else {
                    clearCell(activeCell as { row: number; col: number }, true)
                    makeEditable(rowObj, columnObj)
                  }
                } catch (error: any) {
                  message.error(await extractSdkResponseErrorMsg(error))
                }
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

  const clearSelectedRange = selectedRange.clear.bind(selectedRange)

  useEventListener(document, 'keydown', handleKeyDown)
  useEventListener(document, 'mouseup', handleMouseUp)

  return {
    isCellActive,
    handleMouseDown,
    handleMouseOver,
    clearSelectedRange,
    copyValue,
    isCellSelected,
    activeCell,
    handleCellClick,
  }
}
