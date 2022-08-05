import { isSystemColumn } from 'nocodb-sdk'

export const isColumnLocked = (isLocked, columnObj) => {
  return isLocked || isSystemColumn(columnObj)
}
