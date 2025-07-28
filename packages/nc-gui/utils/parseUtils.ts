import { parseProp, stringifyProp } from 'nocodb-sdk'

export { parseProp, stringifyProp }

export const extractRowBackgroundColorStyle = (row: Row) => {
  const result = {
    rowBgColor: {},
    rowLeftBorderColor: {},
    rowBorderColor: {},
  }

  if (row.rowMeta?.rowBgColor) {
    result.rowBgColor = {
      backgroundColor: `${row.rowMeta?.rowBgColor} !important`,

      ...(row.rowMeta?.rowBorderColor
        ? { borderColor: `${row.rowMeta?.rowBorderColor} !important` }
        : {
            borderColor: `${themeV3Colors.gray[200]} !important`,
          }),
    }
  }

  if (row.rowMeta?.rowLeftBorderColor) {
    result.rowLeftBorderColor = {
      backgroundColor: `${row.rowMeta?.rowLeftBorderColor} !important`,
    }
  }

  return result
}
