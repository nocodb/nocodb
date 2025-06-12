import { ColumnHelper } from 'nocodb-sdk'
import type { type ColumnType, type TableType, UITypes } from 'nocodb-sdk'

export const valueToCopy = (
  rowObj: Row,
  columnObj: ColumnType,
  cb: {
    isPg: (sourceId: string) => boolean
    isMysql: (sourceId: string) => boolean
    meta: TableType
    metas: { [idOrTitle: string]: TableType | any }
  },
  option?: {
    skipUidt?: UITypes[]
  },
) => {
  const { isPg, isMysql, meta, metas } = cb
  const textToCopy = (columnObj.title && rowObj.row[columnObj.title]) ?? ''

  if (option?.skipUidt?.includes(columnObj.uidt as UITypes)) {
    return textToCopy
  }
  return ColumnHelper.parseValue(textToCopy, {
    col: columnObj,
    isMysql,
    isPg,
    meta,
    metas,
    rowId: isMm(columnObj) ? extractPkFromRow(rowObj.row, meta?.columns as ColumnType[]) : null,
  })
}

export const serializeRange = (
  rows: Row[],
  cols: ColumnType[],
  cb: {
    isPg: (sourceId: string) => boolean
    isMysql: (sourceId: string) => boolean
    meta: TableType
    metas?: { [idOrTitle: string]: TableType | any }
  },
  option?: {
    skipUidt?: UITypes[]
  },
) => {
  let html = '<table>'
  let text = ''
  const json: string[][] = []

  rows.forEach((row, i) => {
    let copyRow = '<tr>'
    const jsonRow: string[] = []
    cols.forEach((col, i) => {
      const value = valueToCopy(row, col, cb, option)
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
