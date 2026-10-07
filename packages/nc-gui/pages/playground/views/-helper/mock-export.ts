import type { ColumnType } from 'nocodb-sdk'
import { ExportTypes, UITypes } from 'nocodb-sdk'

/** Plain-text value of a cell, roughly as the server's export writes it. */
function cellText(col: ColumnType, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (col.uidt === UITypes.User && Array.isArray(value)) return value.map((u) => u?.display_name || u?.email).join(', ')
  // inline data: urls would bloat every cell, so those keep just the file name
  if (col.uidt === UITypes.Attachment && Array.isArray(value))
    return value.map((a) => (String(a?.url).startsWith('data:') ? a?.title : `${a?.title} (${a?.url})`)).join(', ')
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** JSON keeps the raw value, minus inline data: urls on attachments. */
function jsonValue(col: ColumnType, value: unknown) {
  if (col.uidt !== UITypes.Attachment || !Array.isArray(value)) return value ?? null
  return value.map(({ url, signedUrl, ...rest }) => (String(url).startsWith('data:') ? rest : { url, signedUrl, ...rest }))
}

const csvEscape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

const icsDate = (v: string) => v.slice(0, 10).replace(/-/g, '')

async function fileContent(type: string, title: string, columns: ColumnType[], rows: Record<string, any>[]) {
  const table = rows.map((r) => columns.map((c) => cellText(c, r[c.title!])))
  const header = columns.map((c) => c.title!)
  switch (type) {
    case ExportTypes.JSON:
      return new Blob(
        [
          JSON.stringify(
            rows.map((r) => Object.fromEntries(columns.map((c) => [c.title, jsonValue(c, r[c.title!])]))),
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      )
    case ExportTypes.EXCEL: {
      const XLSX = await import('xlsx')
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...table]), title.slice(0, 31))
      const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
      return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    }
    case ExportTypes.ICS: {
      const pv = columns.find((c) => c.pv) ?? columns[0]
      const dateCol = columns.find((c) => c.uidt === UITypes.Date || c.uidt === UITypes.DateTime)
      const events = rows
        .filter((r) => dateCol && r[dateCol.title!])
        .map((r) =>
          [
            'BEGIN:VEVENT',
            `UID:${r.Id}@playground`,
            `DTSTART;VALUE=DATE:${icsDate(String(r[dateCol!.title!]))}`,
            `SUMMARY:${cellText(pv!, r[pv!.title!])}`,
            'END:VEVENT',
          ].join('\r\n'),
        )
      return new Blob(
        [['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NocoDB//Playground//EN', ...events, 'END:VCALENDAR'].join('\r\n')],
        {
          type: 'text/calendar',
        },
      )
    }
    default:
      return new Blob([[header, ...table].map((line) => line.map(csvEscape).join(',')).join('\n')], { type: 'text/csv' })
  }
}

const EXTENSION: Record<string, string> = {
  [ExportTypes.CSV]: 'csv',
  [ExportTypes.JSON]: 'json',
  [ExportTypes.EXCEL]: 'xlsx',
  [ExportTypes.ICS]: 'ics',
}

/** Builds the export file in the browser and saves it, standing in for the server's export job + download link. */
export async function downloadMockExport(
  type: string,
  title: string,
  columns: ColumnType[],
  rows: Record<string, any>[],
): Promise<void> {
  const blob = await fileContent(type, title, columns, rows)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title}.${EXTENSION[type] ?? 'csv'}`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
