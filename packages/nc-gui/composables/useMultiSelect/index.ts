import type { MaybeRef } from '@vueuse/core'
import type { ColumnType } from 'nocodb-sdk'
import type { Cell } from './cellRange'
import { CellRange } from './cellRange'
import { copyTable, message, reactive, ref, unref, useCopy, useEventListener, useI18n } from '#imports'
import type { Row } from '~/lib'

/**
 * Utility to help with multi-selecting rows/cells in the smartsheet
 */
export function useMultiSelect(
  fields: MaybeRef<ColumnType[]>,
  data: MaybeRef<Row[]>,
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

          if ((!unref(editEnabled) && e.metaKey) || e.ctrlKey) {
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
            if (makeEditable(rowObj, columnObj) && columnObj.title) {
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
