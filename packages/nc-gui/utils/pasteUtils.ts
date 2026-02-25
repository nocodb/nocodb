import { ColumnHelper } from 'nocodb-sdk'
import type { ColumnType, TableType, UITypes } from 'nocodb-sdk'

export const valueToCopy = (
  rowObj: Row,
  columnObj: ColumnType,
  cb: {
    isPg: (sourceId: string) => boolean
    isMysql: (sourceId: string) => boolean
    meta: TableType
    metas?: { [idOrTitle: string]: TableType | any }
  },
  option?: {
    skipUidt?: UITypes[]
    skipClipboardColumn?: boolean
  },
): {
  textToCopy: any
  cellValue: any
  clipboardColumn: Partial<ColumnType>
  rowId: string
} => {
  const { isPg, isMysql, meta, metas } = cb

  const result: {
    textToCopy: any
    cellValue: any
    clipboardColumn: Partial<ColumnType>
    rowId: string
  } = {
    textToCopy: '',
    cellValue: null,
    clipboardColumn: {},
    rowId: '',
  }

  const textToCopy = (columnObj.title && rowObj.row[columnObj.title]) ?? ''

  result.textToCopy = textToCopy
  result.cellValue = textToCopy

  result.rowId = extractPkFromRow(rowObj.row, (meta?.columns as ColumnType[]) ?? []) ?? ''

  if (!option?.skipClipboardColumn) {
    result.clipboardColumn = ColumnHelper.getClipboardConfig({
      col: columnObj,
    }).column
  }

  if (option?.skipUidt?.includes(columnObj.uidt as UITypes)) {
    return result
  }

  result.textToCopy = ColumnHelper.parseValue(textToCopy, {
    col: columnObj,
    isMysql,
    isPg,
    meta,
    metas,
    rowId: isMm(columnObj) ? result.rowId : null,
  })

  return result
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
  const clipboardItemConfig: Pick<
    NcClipboardDataItemType,
    'columns' | 'rowIds' | 'dbCellValueArr' | 'copiedPlainText' | 'copiedHtml'
  > = {
    columns: cols.map((col) => {
      return ColumnHelper.getClipboardConfig({
        col,
      }).column
    }),
    rowIds: [],
    dbCellValueArr: [],
    copiedPlainText: '',
    copiedHtml: '',
  }

  rows.forEach((row, i) => {
    let copyRow = '<tr>'
    const jsonRow: string[] = []
    const clipboardCellValue: any[] = []
    let recordId = ''

    cols.forEach((col, i) => {
      const { textToCopy, rowId, cellValue } = valueToCopy(row, col, cb, {
        ...(option ?? {}),
        skipClipboardColumn: true,
      })
      copyRow += `<td>${textToCopy}</td>`
      text = `${text}${textToCopy}${cols.length - 1 !== i ? '\t' : ''}`
      jsonRow.push(textToCopy)
      clipboardCellValue.push(cellValue)
      recordId = rowId
    })

    html += `${copyRow}</tr>`

    if (rows.length - 1 !== i) {
      text = `${text}\n`
    }

    json.push(jsonRow)

    clipboardItemConfig.dbCellValueArr!.push(clipboardCellValue)
    clipboardItemConfig.rowIds!.push(recordId)
  })
  html += '</table>'

  clipboardItemConfig.copiedPlainText = text
  clipboardItemConfig.copiedHtml = html

  return { html, text, json, clipboardItemConfig }
}

interface SerializeCb {
  isPg: (sourceId: string) => boolean
  isMysql: (sourceId: string) => boolean
  meta: TableType
  metas?: { [idOrTitle: string]: TableType | any }
}

export const serializeRangeAsJson = (rows: Row[], cols: ColumnType[], cb: SerializeCb): string => {
  const result: Record<string, any>[] = []

  rows.forEach((row) => {
    const obj: Record<string, any> = {}

    cols.forEach((col) => {
      const { textToCopy } = valueToCopy(row, col, cb, { skipClipboardColumn: true })
      obj[col.title ?? ''] = textToCopy === '' ? null : textToCopy
    })

    result.push(obj)
  })

  return JSON.stringify(result, null, 2)
}

function escapeCsvValue(value: any): string {
  const str = value == null ? '' : String(value)

  return str
}

export const serializeRangeAsCsv = (rows: Row[], cols: ColumnType[], cb: SerializeCb): string => {
  const header = cols.map((col) => escapeCsvValue(col.title ?? '')).join(',')
  const dataRows: string[] = []

  rows.forEach((row) => {
    const values = cols.map((col) => {
      const { textToCopy } = valueToCopy(row, col, cb, { skipClipboardColumn: true })
      return escapeCsvValue(textToCopy)
    })
    dataRows.push(values.join(','))
  })

  return [header, ...dataRows].join('\n')
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

function escapeSqlIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export const serializeRangeAsSql = (rows: Row[], cols: ColumnType[], cb: SerializeCb, tableName?: string): string => {
  const table = escapeSqlIdentifier(tableName ?? cb.meta.title ?? 'table')
  const columnNames = cols.map((col) => escapeSqlIdentifier(col.title ?? '')).join(', ')

  const valueRows = rows.map((row) => {
    const values = cols.map((col) => {
      const { textToCopy } = valueToCopy(row, col, cb, { skipClipboardColumn: true })

      if (textToCopy == null || textToCopy === '') {
        return 'NULL'
      }

      if (
        typeof textToCopy === 'number' ||
        (typeof textToCopy === 'string' && !isNaN(Number(textToCopy)) && textToCopy.trim() !== '')
      ) {
        return String(textToCopy)
      }

      return `'${escapeSqlString(String(textToCopy))}'`
    })
    return `(${values.join(', ')})`
  })

  return `INSERT INTO ${table} (${columnNames}) VALUES\n${valueRows.join(',\n')};`
}
