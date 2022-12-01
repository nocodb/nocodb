import type { MaybeRef } from '@vueuse/core'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Cell } from './cellRange'
import { CellRange } from './cellRange'
import convertCellData from './convertCellData'
import type { Row } from '~/lib'
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

/**
 * Utility to help with multi-selecting rows/cells in the smartsheet
 */
export function useMultiSelect(
  _meta: MaybeRef<TableType>,
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

  const selectedCell = reactive<Cell>({ row: null, col: null })
  const selectedRange = reactive(new CellRange())
  let isMouseDown = $ref(false)

  const columnLength = $computed(() => unref(fields)?.length)

  async function copyValue(ctx?: Cell) {
    try {
      if (!selectedRange.isEmpty()) {
        const cprows = unref(data).slice(selectedRange.start.row, selectedRange.end.row + 1) // slice the selected rows for copy
        const cpcols = unref(fields).slice(selectedRange.start.col, selectedRange.end.col + 1) // slice the selected cols for copy

        await copyTable(cprows, cpcols)
        message.success(t('msg.info.copiedToClipboard'))
      } else {
        // if copy was called with context (right click position) - copy value from context
        // else if there is just one selected cell, copy it's value
        const cpRow = ctx?.row ?? selectedCell?.row
        const cpCol = ctx?.col ?? selectedCell?.col

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

  function selectCell(row: number, col: number) {
    selectedRange.clear()
    if (selectedCell.row === row && selectedCell.col === col) return
    editEnabled.value = false
    selectedCell.row = row
    selectedCell.col = col
  }

  function endSelectRange(row: number, col: number) {
    if (!isMouseDown) {
      return
    }
    selectedCell.row = null
    selectedCell.col = null
    selectedRange.endRange({ row, col })
  }

  function isCellSelected(row: number, col: number) {
    if (selectedCell?.row === row && selectedCell?.col === col) {
      return true
    }

    if (selectedRange.isEmpty()) {
      return false
    }

    return (
      col >= selectedRange.start.col &&
      col <= selectedRange.end.col &&
      row >= selectedRange.start.row &&
      row <= selectedRange.end.row
    )
  }

  function startSelectRange(event: MouseEvent, row: number, col: number) {
    // if there was a right click on selected range, don't restart the selection
    const leftClickButton = 0
    if (event?.button !== leftClickButton && isCellSelected(row, col)) {
      return
    }

    if (unref(editEnabled)) {
      event.preventDefault()
      return
    }

    isMouseDown = true
    selectedRange.clear()
    selectedRange.startRange({ row, col })
  }

  useEventListener(document, 'mouseup', (e) => {
    // if the editEnabled is false prevent the mouseup event for not select text
    if (!unref(editEnabled)) {
      e.preventDefault()
    }

    isMouseDown = false
  })

  const onKeyDown = async (e: KeyboardEvent) => {
    // invoke the keyEventHandler if provided and return if it returns true
    if (await keyEventHandler?.(e)) {
      return true
    }

    if (!selectedRange.isEmpty()) {
      // In case the user press tabs or arrows keys
      selectedCell.row = selectedRange.start.row
      selectedCell.col = selectedRange.start.col
    }

    if (selectedCell.row === null || selectedCell.col === null) return

    /** on tab key press navigate through cells */
    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        selectedRange.clear()

        if (e.shiftKey) {
          if (selectedCell.col > 0) {
            selectedCell.col--
            editEnabled.value = false
          } else if (selectedCell.row > 0) {
            selectedCell.row--
            selectedCell.col = unref(columnLength) - 1
            editEnabled.value = false
          }
        } else {
          if (selectedCell.col < unref(columnLength) - 1) {
            selectedCell.col++
            editEnabled.value = false
          } else if (selectedCell.row < unref(data).length - 1) {
            selectedCell.row++
            selectedCell.col = 0
            editEnabled.value = false
          }
        }
        scrollToActiveCell?.()
        break
      /** on enter key press make cell editable */
      case 'Enter':
        e.preventDefault()
        selectedRange.clear()
        makeEditable(unref(data)[selectedCell.row], unref(fields)[selectedCell.col])
        break
      /** on delete key press clear cell */
      case 'Delete':
        e.preventDefault()
        selectedRange.clear()
        await clearCell(selectedCell as { row: number; col: number })
        break
      /** on arrow key press navigate through cells */
      case 'ArrowRight':
        e.preventDefault()
        selectedRange.clear()
        if (selectedCell.col < unref(columnLength) - 1) {
          selectedCell.col++
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowLeft':
        selectedRange.clear()
        e.preventDefault()
        if (selectedCell.col > 0) {
          selectedCell.col--
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowUp':
        selectedRange.clear()
        e.preventDefault()
        if (selectedCell.row > 0) {
          selectedCell.row--
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowDown':
        selectedRange.clear()
        e.preventDefault()
        if (selectedCell.row < unref(data).length - 1) {
          selectedCell.row++
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      default:
        {
          const rowObj = unref(data)[selectedCell.row]

          const columnObj = unref(fields)[selectedCell.col]

          if ((!unref(editEnabled) || !isTypableInputColumn(columnObj)) && (isMac() ? e.metaKey : e.ctrlKey)) {
            switch (e.keyCode) {
              // copy - ctrl/cmd +c
              case 67:
                // set clipboard context only if single cell selected
                if (rowObj.row[columnObj.title!]) {
                  clipboardContext = {
                    value: rowObj.row[columnObj.title!],
                    uidt: columnObj.uidt as UITypes,
                  }
                } else {
                  clipboardContext = null
                }
                await copyValue()
                break
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
                      isMysql.value,
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

                    return await syncCellData?.({ ...selectedCell, updatedColumnTitle: foreignKeyColumn.title })
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
                      isMysql.value,
                    )
                    e.preventDefault()
                    syncCellData?.(selectedCell)
                  } else {
                    clearCell(selectedCell as { row: number; col: number }, true)
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

  useEventListener(document, 'keydown', onKeyDown)

  return {
    selectCell,
    startSelectRange,
    endSelectRange,
    clearSelectedRange: selectedRange.clear.bind(selectedRange),
    copyValue,
    isCellSelected,
    selectedCell,
  }
}
