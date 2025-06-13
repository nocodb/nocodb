import { parseProp, stringifyProp } from 'nocodb-sdk'

export { parseProp, stringifyProp }

export const extractRowBackgroundColorStyle = (row: Row) => {
  let result = {
    rowBgColor: {},
    rowLeftBorderColor: {},
  }

  if (row.rowMeta?.rowBgColor) {
    result.rowBgColor = {
      backgroundColor: row.rowMeta?.rowBgColor,
    }
  }

  if (row.rowMeta?.rowLeftBorderColor) {
    result.rowLeftBorderColor = {
      backgroundColor: row.rowMeta?.rowLeftBorderColor,
    }
  }

  return result
}
