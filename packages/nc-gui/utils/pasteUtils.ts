import { type ColumnType, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

export function isPasteable(row?: Row, col?: ColumnType, showInfo = false) {
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
