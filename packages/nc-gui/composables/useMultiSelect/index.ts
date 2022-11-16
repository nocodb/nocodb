import type { MaybeRef } from '@vueuse/core'
import { UITypes } from 'nocodb-sdk'
import { message, reactive, ref, unref, useCopy, useEventListener, useI18n } from '#imports'

interface SelectedBlock {
  row: number | null
  col: number | null
}

/**
 * Utility to help with multi-selecting rows/cells in the smartsheet
 */
export function useMultiSelect(
  fields: MaybeRef<any[]>,
  data: MaybeRef<any[]>,
  _editEnabled: MaybeRef<boolean>,
  isPkAvail: MaybeRef<boolean | undefined>,
  clearCell: Function,
  makeEditable: Function,
  scrollToActiveCell?: (row?: number | null, col?: number | null) => void,
  keyEventHandler?: Function,
) {
  const { t } = useI18n()

  const { copy } = useCopy()

  const editEnabled = ref(_editEnabled)

  const selected = reactive<SelectedBlock>({ row: null, col: null })

  // save the first and the last column where the mouse is down while the value isSelectedRow is true
  const selectedRows = reactive({ startCol: NaN, endCol: NaN, startRow: NaN, endRow: NaN })

  // calculate the min and the max column where the mouse is down while the value isSelectedRow is true
  const rangeRows = reactive({ minRow: NaN, maxRow: NaN, minCol: NaN, maxCol: NaN })

  // check if mouse is down or up false=mouseup and true=mousedown
  let isSelectedBlock = $ref(false)

  const columnLength = $computed(() => unref(fields)?.length)

  function selectCell(row: number, col: number) {
    clearRangeRows()
    editEnabled.value = false
    selected.row = row
    selected.col = col
  }

  function selectBlock(row: number, col: number) {
    // if selected.col and selected.row are null and isSelectedBlock is true that means you are selecting a block
    if (selected.col === null || selected.row === null) {
      if (isSelectedBlock) {
        // save the next value after the selectionStart
        selectedRows.endCol = col
        selectedRows.endRow = row
      }
    } else if (selected.col !== col || selected.row !== row) {
      // if selected.col and selected.row is not null but the selected col and row is not equal at the row and col where the mouse is clicking
      // and isSelectedBlock is true that means you are selecting a block
      if (isSelectedBlock) {
        selected.col = null
        selected.row = null
        // save the next value after the selectionStart
        selectedRows.endCol = col
        selectedRows.endRow = row
      }
    }
  }

  function selectedRange(row: number, col: number) {
    if (
      !isNaN(selectedRows.startRow) &&
      !isNaN(selectedRows.startCol) &&
      !isNaN(selectedRows.endRow) &&
      !isNaN(selectedRows.endCol)
    ) {
      // check if column selection is up or down
      rangeRows.minRow = Math.min(selectedRows.startRow, selectedRows.endRow)
      rangeRows.maxRow = Math.max(selectedRows.startRow, selectedRows.endRow)
      rangeRows.minCol = Math.min(selectedRows.startCol, selectedRows.endCol)
      rangeRows.maxCol = Math.max(selectedRows.startCol, selectedRows.endCol)

      // return if the column is in between the selection
      return col >= rangeRows.minCol && col <= rangeRows.maxCol && row >= rangeRows.minRow && row <= rangeRows.maxRow
    } else {
      return false
    }
  }

  function startSelectRange(event: MouseEvent, row: number, col: number) {
    // if editEnabled but the selected col or the selected row is not equal like the actual row or col, enabled selected multiple rows
    if (unref(editEnabled) && (selected.col !== col || selected.row !== row)) {
      event.preventDefault()
    } else if (!unref(editEnabled)) {
      // if editEnabled is not true, enabled selected multiple rows
      event.preventDefault()
    }

    // clear the selection when the mouse is down
    selectedRows.startCol = NaN
    selectedRows.endCol = NaN
    selectedRows.startRow = NaN
    selectedRows.endRow = NaN
    // asing where the selection start
    selectedRows.startCol = col
    selectedRows.startRow = row
    isSelectedBlock = true
  }

  function clearRangeRows() {
    // when the selection starts or ends or when enter/arrow/tab is pressed
    // this clear the previous selection
    rangeRows.minCol = NaN
    rangeRows.maxCol = NaN
    rangeRows.minRow = NaN
    rangeRows.maxRow = NaN
    selectedRows.startRow = NaN
    selectedRows.startCol = NaN
    selectedRows.endRow = NaN
    selectedRows.endCol = NaN
  }

  useEventListener(document, 'mouseup', (e) => {
    // if the editEnabled is false prevent the mouseup event for not select text
    if (!unref(editEnabled)) {
      e.preventDefault()
    }

    isSelectedBlock = false
  })

  const onKeyDown = async (e: KeyboardEvent) => {
    // invoke the keyEventHandler if provided and return if it returns true
    if (await keyEventHandler?.(e)) {
      return
    }

    if (
      !isNaN(selectedRows.startRow) &&
      !isNaN(selectedRows.startCol) &&
      !isNaN(selectedRows.endRow) &&
      !isNaN(selectedRows.endCol)
    ) {
      // In case the user press tabs or arrows keys
      selected.row = selectedRows.startRow
      selected.col = selectedRows.startCol
    }

    if (selected.row === null || selected.col === null) return

    /** on tab key press navigate through cells */
    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        clearRangeRows()

        if (e.shiftKey) {
          if (selected.col > 0) {
            selected.col--
            editEnabled.value = false
          } else if (selected.row > 0) {
            selected.row--
            selected.col = unref(columnLength) - 1
            editEnabled.value = false
          }
        } else {
          if (selected.col < unref(columnLength) - 1) {
            selected.col++
            editEnabled.value = false
          } else if (selected.row < unref(data).length - 1) {
            selected.row++
            selected.col = 0
            editEnabled.value = false
          }
        }
        scrollToActiveCell?.()
        break
      /** on enter key press make cell editable */
      case 'Enter':
        e.preventDefault()
        clearRangeRows()
        makeEditable(unref(data)[selected.row], unref(fields)[selected.col])
        break
      /** on delete key press clear cell */
      case 'Delete':
        e.preventDefault()
        clearRangeRows()
        await clearCell(selected as { row: number; col: number })
        break
      /** on arrow key press navigate through cells */
      case 'ArrowRight':
        e.preventDefault()
        clearRangeRows()
        if (selected.col < unref(columnLength) - 1) {
          selected.col++
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowLeft':
        clearRangeRows()
        e.preventDefault()
        clearRangeRows()
        if (selected.col > 0) {
          selected.col--
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowUp':
        clearRangeRows()
        e.preventDefault()
        clearRangeRows()
        if (selected.row > 0) {
          selected.row--
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      case 'ArrowDown':
        clearRangeRows()
        e.preventDefault()
        clearRangeRows()
        if (selected.row < unref(data).length - 1) {
          selected.row++
          scrollToActiveCell?.()
          editEnabled.value = false
        }
        break
      default:
        {
          const rowObj = unref(data)[selected.row]

          const columnObj = unref(fields)[selected.col]

          let cptext = '' // variable for save the text to be copy

          if (!isNaN(rangeRows.minRow) && !isNaN(rangeRows.maxRow) && !isNaN(rangeRows.minCol) && !isNaN(rangeRows.maxCol)) {
            const cprows = unref(data).slice(rangeRows.minRow, rangeRows.maxRow + 1) // slice the selected rows for copy

            const cpcols = unref(fields).slice(rangeRows.minCol, rangeRows.maxCol + 1) // slice the selected cols for copy

            cprows.forEach((row) => {
              cpcols.forEach((col) => {
                // todo: JSON stringify the attachment cell and LTAR contents for copy
                // filter attachment cells and LATR cells from copy
                if (col.uidt !== UITypes.Attachment && col.uidt !== UITypes.LinkToAnotherRecord) {
                  cptext = `${cptext} ${row.row[col.title]} \t`
                }
              })

              cptext = `${cptext.trim()}\n`
            })

            cptext.trim()
          } else {
            cptext = rowObj.row[columnObj.title] || ''
          }

          if ((!unref(editEnabled) && e.metaKey) || e.ctrlKey) {
            switch (e.keyCode) {
              // copy - ctrl/cmd +c
              case 67:
                await copy(cptext)
                break
            }
          }

          if (unref(editEnabled) || e.ctrlKey || e.altKey || e.metaKey) {
            return
          }

          /** on letter key press make cell editable and empty */
          if (e.key.length === 1) {
            if (!unref(isPkAvail) && !rowObj.rowMeta.new) {
              // Update not allowed for table which doesn't have primary Key
              return message.info(t('msg.info.updateNotAllowedWithoutPK'))
            }
            if (makeEditable(rowObj, columnObj)) {
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
    selectBlock,
    selectedRange,
    clearRangeRows,
    startSelectRange,
    selected,
    selectedRows,
    rangeRows,
  }
}
