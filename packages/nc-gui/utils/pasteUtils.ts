import { ColumnHelper, UITypes, handleTZ, parseProp, renderValue } from 'nocodb-sdk'
import type { ColumnType, TableType } from 'nocodb-sdk'

/**
 * When a Formula cell's rendered result is a single top-level URL token (the whole cell is one
 * `URI::(url) LABEL::(label)`, with no surrounding text and no `display_type` override), produce
 * cleaner clipboard representations that match what the cell displays:
 *   - Valid url   → `plain` markdown `[label](url)` (bare `url` when there's no distinct label) and
 *                   `html` clean anchor `<a href="url">label</a>`.
 *   - Invalid url → the cell renders the label (or the raw url text when there's no label) as plain
 *                   text instead of a link, so copy just that text — never the raw `URI::()`/`LABEL::()`
 *                   markup. No `html` representation is emitted in this case.
 *
 * Returns `null` for anything that is not a single top-level-URL formula cell (non-formula columns,
 * formulas with a `display_type` cell override, empty values, mixed text+link results, or bare text).
 */
export const formatFormulaUrlForClipboard = (
  col: ColumnType,
  rawValue: any,
  opts: { isPg: (sourceId: string) => boolean },
): { html?: string; plain: string } | null => {
  // Only string-type formula cells render as links — a `display_type` override renders as a real cell.
  if (col.uidt !== UITypes.Formula) return null
  if (parseProp(col.meta)?.display_type) return null
  if (rawValue === null || rawValue === undefined || rawValue === '') return null

  // Render exactly like the cell does (see virtual-cell/Formula.vue).
  const result = col.source_id && opts.isPg(col.source_id) ? renderValue(handleTZ(rawValue)) : renderValue(rawValue)

  const linkHtml = replaceUrlsWithLink(result)
  if (!linkHtml || typeof linkHtml !== 'string') return null

  // A single non-empty segment after link substitution means the whole cell renders as one unit:
  // either one clickable link, or — when the url is invalid — plain text.
  const segments = getFormulaTextSegments(linkHtml).filter((seg) => seg.text?.trim())
  if (segments.length !== 1) return null
  const segment = segments[0]

  // Invalid url: the cell shows the label (or the raw url text when there's no label) as plain text,
  // not a link. Copy that displayed text instead of the raw `URI::(url) LABEL::(label)` formula markup.
  if (!segment.url) {
    return { plain: segment.text }
  }

  const url = segment.url
  const label = segment.text ?? ''

  // Anchor built via DOM so the href attribute and text content are escaped for free.
  const anchor = document.createElement('a')
  anchor.textContent = label
  anchor.setAttribute('href', url)

  let plain: string
  if (!label || label === url) {
    // Bare URL — avoid a redundant `[url](url)`.
    plain = url
  } else {
    const safeLabel = label.replace(/([\\[\]])/g, '\\$1')
    const safeUrl = /[\s()]/.test(url) ? `<${url}>` : url
    plain = `[${safeLabel}](${safeUrl})`
  }

  return { html: anchor.outerHTML, plain }
}

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
    // Opt-in: build richer clipboard representations (markdown text/plain + extensible clipboardContent map).
    enrichClipboard?: boolean
    // Whether the `text/html` representation may be set (gated to single-column copies). Defaults to true.
    includeHtml?: boolean
  },
): {
  textToCopy: any
  cellValue: any
  clipboardColumn: Partial<ColumnType>
  rowId: string
  // Extensible per-MIME clipboard overrides, e.g. clipboardContent['text/html']. Never holds 'text/plain'
  // (that is represented by `textToCopy`).
  clipboardContent: Record<string, string>
} => {
  const { isPg, isMysql, meta, metas } = cb

  const result: {
    textToCopy: any
    cellValue: any
    clipboardColumn: Partial<ColumnType>
    rowId: string
    clipboardContent: Record<string, string>
  } = {
    textToCopy: '',
    cellValue: null,
    clipboardColumn: {},
    rowId: '',
    clipboardContent: {},
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
    rowId: isMMOrMMLike(columnObj) ? result.rowId : null,
  })

  // For a top-level-URL formula cell, override text/plain with markdown and (single-column only) add a
  // clean anchor under text/html. `textToCopy` for non-enriched cells stays the raw parsed value, so
  // `json`/`dbCellValueArr` (used by fill-drag + internal paste) are unaffected.
  if (option?.enrichClipboard) {
    const formatted = formatFormulaUrlForClipboard(columnObj, textToCopy, { isPg })
    if (formatted) {
      result.textToCopy = formatted.plain
      if (option.includeHtml !== false && formatted.html) {
        result.clipboardContent['text/html'] = formatted.html
      }
    }
  }

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
    enrichClipboard?: boolean
  },
) => {
  let html = '<table>'
  let text = ''
  const json: string[][] = []
  // For a single-column copy of a URL-formula column we emit a flat list of <a> items instead of a table.
  const htmlListItems: string[] = []
  let hasHtmlAnchor = false
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
      const { textToCopy, rowId, cellValue, clipboardContent } = valueToCopy(row, col, cb, {
        ...(option ?? {}),
        skipClipboardColumn: true,
        // text/html links are only emitted for single-column copies.
        includeHtml: cols.length === 1,
      })
      const cellHtml = clipboardContent['text/html']
      if (cellHtml) hasHtmlAnchor = true
      copyRow += `<td>${cellHtml ?? textToCopy}</td>`
      if (cols.length === 1) htmlListItems.push(cellHtml ?? textToCopy)
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

  // Single-column copy of a URL-formula column → flat list of <a> items (joined by `<br/>` + newline) so it
  // pastes as a clean link list. Other single-column copies keep the <table> to preserve row-wise paste.
  const finalHtml = cols.length === 1 && hasHtmlAnchor ? htmlListItems.join('<br/>\n') : html

  clipboardItemConfig.copiedPlainText = text
  clipboardItemConfig.copiedHtml = finalHtml

  return { html: finalHtml, text, json, clipboardItemConfig }
}
