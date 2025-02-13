import {
  type AIRecordType,
  type ColumnType,
  type LinkToAnotherRecordType,
  type TableType,
  UITypes,
  type UserFieldRecordType,
  isDateMonthFormat,
} from 'nocodb-sdk'
import dayjs from 'dayjs'

export const valueToCopy = (
  rowObj: Row,
  columnObj: ColumnType,
  cb: {
    isPg: (sourceId: string) => boolean
    isMysql: (sourceId: string) => boolean
    meta: TableType
  },
) => {
  const { isPg, isMysql, meta } = cb
  let textToCopy = (columnObj.title && rowObj.row[columnObj.title]) || ''

  if (columnObj.uidt === UITypes.Checkbox) {
    textToCopy = !!textToCopy
  }

  if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(columnObj.uidt as UITypes)) {
    if (textToCopy) {
      textToCopy = Array.isArray(textToCopy)
        ? textToCopy
        : [textToCopy]
            .map((user: UserFieldRecordType) => {
              return user.email
            })
            .join(', ')
    }
  }

  if (isBt(columnObj) || isOo(columnObj)) {
    // fk_related_model_id is used to prevent paste operation in different fk_related_model_id cell
    textToCopy = {
      fk_related_model_id: (columnObj.colOptions as LinkToAnotherRecordType).fk_related_model_id,
      value: textToCopy || null,
    }
  }

  if (isMm(columnObj)) {
    textToCopy = {
      rowId: extractPkFromRow(rowObj.row, meta.columns as ColumnType[]),
      columnId: columnObj.id,
      fk_related_model_id: (columnObj.colOptions as LinkToAnotherRecordType).fk_related_model_id,
      value: !isNaN(+textToCopy) ? +textToCopy : 0,
    }
  }

  if (typeof textToCopy === 'object') {
    textToCopy = JSON.stringify(textToCopy)
  } else {
    textToCopy = textToCopy.toString()
  }

  if (columnObj.uidt === UITypes.Formula) {
    textToCopy = textToCopy.replace(/\b(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})\b/g, (d: string) => {
      // TODO(timezone): retrieve the format from the corresponding column meta
      // assume hh:mm at this moment
      return dayjs(d).utc().local().format('YYYY-MM-DD HH:mm')
    })
  }

  if ([UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(columnObj.uidt as UITypes)) {
    // remove `"`
    // e.g. "2023-05-12T08:03:53.000Z" -> 2023-05-12T08:03:53.000Z
    textToCopy = textToCopy.replace(/["']/g, '')

    const isMySQL = isMysql(columnObj.source_id)

    let d = dayjs(textToCopy)

    if (!d.isValid()) {
      // insert a datetime value, copy the value without refreshing
      // e.g. textToCopy = 2023-05-12T03:49:25.000Z
      // feed custom parse format
      d = dayjs(textToCopy, isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ')
    }

    // users can change the datetime format in UI
    // `textToCopy` would be always in YYYY-MM-DD HH:mm:ss(Z / +xx:yy) format
    // therefore, here we reformat to the correct datetime format based on the meta
    textToCopy = d.format(constructDateTimeFormat(columnObj))

    if (!d.isValid()) {
      // return empty string for invalid datetime
      return ''
    }
  }

  if (columnObj.uidt === UITypes.Date) {
    const dateFormat = parseProp(columnObj.meta)?.date_format

    if (dateFormat && isDateMonthFormat(dateFormat)) {
      // any date month format (e.g. YYYY-MM) couldn't be stored in database
      // with date type since it is not a valid date
      // therefore, we reformat the value here to display with the formatted one
      // e.g. 2023-06-03 -> 2023-06
      textToCopy = dayjs(textToCopy, dateFormat).format(dateFormat)
    } else {
      // e.g. 2023-06-03 (in DB) -> 03/06/2023 (in UI)
      textToCopy = dayjs(textToCopy, 'YYYY-MM-DD').format(dateFormat)
    }
  }

  if (columnObj.uidt === UITypes.Time) {
    // remove `"`
    // e.g. "2023-05-12T08:03:53.000Z" -> 2023-05-12T08:03:53.000Z
    textToCopy = textToCopy.replace(/["']/g, '')

    const isMySQL = isMysql(columnObj.source_id)
    const isPostgres = isPg(columnObj.source_id)

    let d = dayjs(textToCopy)

    if (!d.isValid()) {
      // insert a datetime value, copy the value without refreshing
      // e.g. textToCopy = 2023-05-12T03:49:25.000Z
      // feed custom parse format
      d = dayjs(textToCopy, isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ')
    }

    if (!d.isValid()) {
      // MySQL and Postgres store time in HH:mm:ss format so we need to feed custom parse format
      d = isMySQL || isPostgres ? dayjs(textToCopy, 'HH:mm:ss') : dayjs(textToCopy)
    }

    if (!d.isValid()) {
      // return empty string for invalid time
      return ''
    }

    textToCopy = d.format(constructTimeFormat(columnObj))
  }

  if (columnObj.uidt === UITypes.LongText) {
    if (parseProp(columnObj.meta)?.[LongTextAiMetaProp] === true) {
      const aiCell: AIRecordType = (columnObj.title && rowObj.row[columnObj.title]) || null

      if (aiCell) {
        textToCopy = aiCell.value
      }
    } else {
      textToCopy = `"${textToCopy.replace(/"/g, '\\"')}"`
    }
  }

  return textToCopy
}

export const serializeRange = (
  rows: Row[],
  cols: ColumnType[],
  cb: {
    isPg: (sourceId: string) => boolean
    isMysql: (sourceId: string) => boolean
    meta: TableType
  },
) => {
  let html = '<table>'
  let text = ''
  const json: string[][] = []

  rows.forEach((row, i) => {
    let copyRow = '<tr>'
    const jsonRow: string[] = []
    cols.forEach((col, i) => {
      const value = valueToCopy(row, col, cb)
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
