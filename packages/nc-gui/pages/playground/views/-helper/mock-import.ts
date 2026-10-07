import { UITypes } from 'nocodb-sdk'

export interface ParsedSheet {
  name?: string
  headers: string[]
  rows: unknown[][]
}

/** RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) rows.push([...row, field])
  return rows.filter((r) => r.some((v) => v !== ''))
}

/** Reads an uploaded import file the way the server's csv / json / excel handlers do. */
export async function parseImportFile(file: File, importType: string): Promise<ParsedSheet[]> {
  if (importType === 'excel') {
    const XLSX = await import('xlsx')
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    return book.SheetNames.map((name) => {
      const [headers = [], ...rows] = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name]!, { header: 1, blankrows: false })
      return { name, headers: headers.map(String), rows }
    })
  }
  const text = await file.text()
  if (importType === 'json') {
    const data = JSON.parse(text)
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : [data]
    const headers = [...new Set(list.flatMap((r) => Object.keys(r ?? {})))]
    return [{ headers, rows: list.map((r) => headers.map((h) => r?.[h] ?? null)) }]
  }
  const [headers = [], ...rows] = parseCsv(text)
  return [{ headers, rows }]
}

const columnName = (title: string, i: number) =>
  title.trim().toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, '') || `field_${i + 1}`

/** Detected columns as the server previews them: every field starts as SingleLineText. */
export function previewColumns(headers: string[]) {
  return headers.map((h, i) => {
    const title = String(h ?? '').trim() || `Field ${i + 1}`
    const cn = columnName(title, i)
    return { title, column_name: cn, ref_column_name: cn, uidt: UITypes.SingleLineText, key: i, meta: {} }
  })
}

/** Sheet rows keyed by the previewed column names. */
export function sheetRecords(sheet: ParsedSheet) {
  const columns = previewColumns(sheet.headers)
  return sheet.rows.map((row) => Object.fromEntries(columns.map((c, i) => [c.column_name, row[i] ?? null])))
}
