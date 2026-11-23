import type { ColumnType, FilterType, SortType } from 'nocodb-sdk'
import { stringifyFilterOrSortArr } from './dataUtils'

export type PrintPaperSize =
  | 'letter'
  | 'tabloid'
  | 'legal'
  | 'statement'
  | 'executive'
  | 'folio'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'B4'
  | 'B5'

export type PrintOrientation = 'portrait' | 'landscape'

export type PrintFieldSizing = 'actualSize' | 'fitToWidth'

export type PrintFontSize = 'extraSmall' | 'small' | 'normal' | 'large' | 'extraLarge'

export interface PrintSettings {
  paperSize: PrintPaperSize
  orientation: PrintOrientation
  fieldSizing: PrintFieldSizing
  fontSize: PrintFontSize
  showTitle: boolean
  showRowNumbers: boolean
  wrapText: boolean
}

/** Portrait width × height, in the unit the paper is named in. */
export const PRINT_PAPER_SIZES: Record<PrintPaperSize, { width: number; height: number; unit: 'in' | 'mm' }> = {
  letter: { width: 8.5, height: 11, unit: 'in' },
  tabloid: { width: 11, height: 17, unit: 'in' },
  legal: { width: 8.5, height: 14, unit: 'in' },
  statement: { width: 5.5, height: 8.5, unit: 'in' },
  executive: { width: 7.25, height: 10.5, unit: 'in' },
  folio: { width: 8.5, height: 13, unit: 'in' },
  A3: { width: 297, height: 420, unit: 'mm' },
  A4: { width: 210, height: 297, unit: 'mm' },
  A5: { width: 148, height: 210, unit: 'mm' },
  B4: { width: 250, height: 353, unit: 'mm' },
  B5: { width: 176, height: 250, unit: 'mm' },
}

export const PRINT_FONT_SIZES_PX: Record<PrintFontSize, number> = {
  extraSmall: 9,
  small: 11,
  normal: 13,
  large: 15,
  extraLarge: 17,
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'letter',
  orientation: 'portrait',
  fieldSizing: 'actualSize',
  fontSize: 'normal',
  showTitle: true,
  showRowNumbers: true,
  wrapText: false,
}

/** Most records one print holds; a larger view prints in ranges. */
export const PRINT_RECORD_LIMIT = 10_000

/**
 * Most table cells one print renders, all before the browser's print dialog opens.
 * Measured at about 9s and 450MB of heap per 100k cells; 950k cells crashed the tab.
 */
export const PRINT_CELL_BUDGET = 100_000

/** The list APIs' default max page size. */
export const PRINT_FETCH_PAGE_SIZE = 1000

export const PRINT_PAGE_MARGIN_IN = 0.4

export const PRINT_ROW_NUMBER_WIDTH_PX = 40

/** Horizontal cell padding plus borders. */
const PRINT_CELL_INSET_PX = 14

export const PRINT_DEFAULT_COLUMN_WIDTH_PX = 200

/** Fit to page width never shrinks a column below this; fields that still don't fit go on a further band. */
export const PRINT_MIN_FIT_COLUMN_WIDTH_PX = 60

/** Grid column widths are measured at the grid's 13px text. */
const GRID_FONT_SIZE_PX = 13

const CSS_PX_PER_IN = 96

const MM_PER_IN = 25.4

const PRINT_SETTINGS_STORAGE_PREFIX = 'nc-print-settings:'

const SETTING_VALUES: { [K in keyof PrintSettings]: readonly PrintSettings[K][] } = {
  paperSize: Object.keys(PRINT_PAPER_SIZES) as PrintPaperSize[],
  orientation: ['portrait', 'landscape'],
  fieldSizing: ['actualSize', 'fitToWidth'],
  fontSize: Object.keys(PRINT_FONT_SIZES_PX) as PrintFontSize[],
  showTitle: [true, false],
  showRowNumbers: [true, false],
  wrapText: [true, false],
}

/** Keeps only known values, so a stale or hand-edited entry falls back to the defaults. */
export function normalizePrintSettings(value: unknown, defaults: PrintSettings = DEFAULT_PRINT_SETTINGS): PrintSettings {
  const settings = { ...defaults }
  if (!value || typeof value !== 'object') return settings

  for (const key of Object.keys(SETTING_VALUES) as (keyof PrintSettings)[]) {
    const candidate = (value as Record<string, unknown>)[key]
    if ((SETTING_VALUES[key] as readonly unknown[]).includes(candidate)) {
      ;(settings as Record<string, unknown>)[key] = candidate
    }
  }

  return settings
}

export function loadPrintSettings(storageKey: string, defaults: PrintSettings = DEFAULT_PRINT_SETTINGS): PrintSettings {
  try {
    const raw = localStorage.getItem(PRINT_SETTINGS_STORAGE_PREFIX + storageKey)
    return normalizePrintSettings(raw ? JSON.parse(raw) : null, defaults)
  } catch {
    return { ...defaults }
  }
}

export function savePrintSettings(storageKey: string, settings: PrintSettings) {
  try {
    localStorage.setItem(PRINT_SETTINGS_STORAGE_PREFIX + storageKey, JSON.stringify(settings))
  } catch {}
}

function paperDimensionsIn(settings: PrintSettings) {
  const paper = PRINT_PAPER_SIZES[settings.paperSize]
  const factor = paper.unit === 'mm' ? 1 / MM_PER_IN : 1
  const width = paper.width * factor
  const height = paper.height * factor

  return settings.orientation === 'landscape' ? { width: height, height: width } : { width, height }
}

export function getPrintPageCss(settings: PrintSettings) {
  const paper = PRINT_PAPER_SIZES[settings.paperSize]
  const [width, height] = settings.orientation === 'landscape' ? [paper.height, paper.width] : [paper.width, paper.height]

  return `@page { size: ${width}${paper.unit} ${height}${paper.unit}; margin: ${PRINT_PAGE_MARGIN_IN}in; }`
}

/** Content width of one printed page, in CSS px. */
export function getPrintableWidthPx(settings: PrintSettings) {
  return Math.floor((paperDimensionsIn(settings).width - 2 * PRINT_PAGE_MARGIN_IN) * CSS_PX_PER_IN)
}

/** A column's printed width at the chosen font size, from its grid width (e.g. `"240px"`). */
export function getPrintColumnWidthPx(gridWidth: string | number | undefined | null, settings: PrintSettings) {
  const parsed = typeof gridWidth === 'number' ? gridWidth : parseInt(gridWidth ?? '', 10)
  const width = Number.isFinite(parsed) && parsed > 0 ? parsed : PRINT_DEFAULT_COLUMN_WIDTH_PX

  return Math.round((width * PRINT_FONT_SIZES_PX[settings.fontSize]) / GRID_FONT_SIZE_PX)
}

/**
 * Actual size: caps widths so every band fits the page. The repeated first field takes at most half,
 * and any other column at most what is left beside it.
 */
export function capPrintColumnWidths<T>(columns: { column: T; width: number }[], availableWidth: number) {
  const firstWidth = Math.min(columns[0]?.width ?? 0, Math.floor(availableWidth / 2))

  return columns.map(({ column, width }, index) => ({
    column,
    width: index ? Math.min(width, availableWidth - firstWidth) : firstWidth,
  }))
}

/** Fit to page width: scales columns to fill the page, keeping each readable. */
export function fitPrintColumnWidths<T>(columns: { column: T; width: number }[], availableWidth: number) {
  const total = columns.reduce((sum, { width }) => sum + width, 0)
  if (!total) return columns

  const scale = availableWidth / total

  return columns.map(({ column, width }) => ({
    column,
    width: Math.max(PRINT_MIN_FIT_COLUMN_WIDTH_PX, Math.floor(width * scale)),
  }))
}

/**
 * Columns that don't fit across the page continue on further pages.
 * Each band repeats the first column so its rows can still be told apart.
 */
export function splitPrintColumnBands<T>(columns: { column: T; width: number }[], availableWidth: number): T[][] {
  const [first, ...rest] = columns
  if (!first) return []

  const bands: T[][] = []
  const firstWidth = Math.min(first.width, availableWidth)
  let band: T[] = [first.column]
  let used = firstWidth

  for (const { column, width } of rest) {
    if (band.length > 1 && used + width > availableWidth) {
      bands.push(band)
      band = [first.column]
      used = firstWidth
    }

    band.push(column)
    used += width
  }

  bands.push(band)

  return bands
}

/** Wide enough for the largest row number, e.g. 10001 in a later batch. Digits are about 0.6em wide. */
export function getPrintRowNumberWidthPx(lastRowNumber: number, settings: PrintSettings) {
  if (!settings.showRowNumbers) return 0

  const digits = String(Math.max(Math.floor(lastRowNumber), 1)).length
  const fontSize = PRINT_FONT_SIZES_PX[settings.fontSize] ?? GRID_FONT_SIZE_PX

  return Math.max(PRINT_ROW_NUMBER_WIDTH_PX, Math.ceil(digits * fontSize * 0.6) + PRINT_CELL_INSET_PX)
}

/** Printed widths for the columns, then the bands they split into across pages. */
export function getPrintColumnBands<T extends { id?: string }>(
  columns: T[],
  columnWidths: Record<string, string | number | undefined | null>,
  settings: PrintSettings,
  lastRowNumber = 0,
) {
  const rowNumberWidth = getPrintRowNumberWidthPx(lastRowNumber, settings)
  const availableWidth = getPrintableWidthPx(settings) - rowNumberWidth

  const sized = columns.map((column) => ({
    column,
    width: getPrintColumnWidthPx(columnWidths[column.id!], settings),
  }))

  const columnsWithWidth =
    settings.fieldSizing === 'fitToWidth'
      ? fitPrintColumnWidths(sized, availableWidth)
      : capPrintColumnWidths(sized, availableWidth)

  return { rowNumberWidth, availableWidth, columnsWithWidth, bands: splitPrintColumnBands(columnsWithWidth, availableWidth) }
}

/** Cells one record prints: a row in every band, each repeating the first field and the row number. */
export function countPrintCellsPerRecord<T extends { id?: string }>(
  columns: T[],
  columnWidths: Record<string, string | number | undefined | null>,
  settings: PrintSettings,
) {
  const { bands } = getPrintColumnBands(columns, columnWidths, settings)

  return bands.reduce((sum, band) => sum + band.length + (settings.showRowNumbers ? 1 : 0), 0)
}

/** Records one print can hold, so wide views stay within the cell budget. */
export function getPrintRecordLimit(cellsPerRecord: number) {
  if (cellsPerRecord <= 0) return PRINT_RECORD_LIMIT

  const limit = Math.floor(PRINT_CELL_BUDGET / cellsPerRecord)
  const rounded = limit >= 100 ? Math.floor(limit / 100) * 100 : Math.max(limit, 1)

  return Math.min(rounded, PRINT_RECORD_LIMIT)
}

export type PrintItem<Row> =
  | { type: 'group'; level: number; value: unknown; count: number; partial: boolean }
  /** Null in a group the batch starts inside, where the row's place in its group isn't known. */
  | { type: 'row'; row: Row; rowNumber: number | null }

/**
 * Flattens rows that are already sorted by the group fields into group headers and rows.
 * Row numbers restart in each innermost group, as in the grid; ungrouped, they count from `firstRowNumber`.
 * A group open at a cut edge may have more records than were loaded, so it is marked partial.
 */
export function buildPrintItems<Row>(
  rows: Row[],
  groupValueGetters: ((row: Row) => unknown)[],
  { firstRowNumber = 1, cutBefore = false, cutAfter = false } = {},
): PrintItem<Row>[] {
  const items: PrintItem<Row>[] = []
  const openHeaders: { type: 'group'; level: number; value: unknown; count: number; partial: boolean; key: string }[] = []
  let rowNumber = groupValueGetters.length ? 0 : firstRowNumber - 1
  let isNumbered = !(cutBefore && groupValueGetters.length)

  for (const [index, row] of rows.entries()) {
    const keys = groupValueGetters.map((getValue) => groupKey(getValue(row)))
    const firstChanged = keys.findIndex((key, level) => openHeaders[level]?.key !== key)

    if (firstChanged !== -1) {
      openHeaders.length = firstChanged
      for (let level = firstChanged; level < keys.length; level++) {
        const header = {
          type: 'group' as const,
          level,
          value: groupValueGetters[level]!(row),
          count: 0,
          partial: cutBefore && index === 0,
          key: keys[level]!,
        }
        openHeaders.push(header)
        items.push(header)
      }
      rowNumber = 0
      isNumbered ||= index > 0
    }

    for (const header of openHeaders) header.count++

    items.push({ type: 'row', row, rowNumber: isNumbered ? ++rowNumber : null })
  }

  if (cutAfter) for (const header of openHeaders) header.partial = true

  return items.map((item) =>
    item.type === 'group'
      ? { type: 'group', level: item.level, value: item.value, count: item.count, partial: item.partial }
      : item,
  )
}

function groupKey(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export interface PrintRowsPage {
  list: Record<string, any>[]
  pageInfo?: { totalRows?: number; isLastPage?: boolean }
}

/** Pages through `fetchPage` from row `start` until every matching row, or `limit` rows, are loaded. */
export async function loadAllPrintRows(
  fetchPage: (offset: number, limit: number) => Promise<PrintRowsPage>,
  limit: number,
  pageSize: number,
  start = 0,
) {
  const rows: Record<string, any>[] = []
  let total = 0

  while (rows.length < limit) {
    const { list, pageInfo } = await fetchPage(start + rows.length, Math.min(pageSize, limit - rows.length))

    rows.push(...list)
    total = pageInfo?.totalRows ?? start + rows.length

    if (!list.length || pageInfo?.isLastPage || start + rows.length >= total) break
  }

  return { rows, total: Math.max(total, start + rows.length) }
}

export interface PrintListQuery {
  sorts: SortType[]
  nestedFilters: FilterType[]
  where?: string
  groupBy: { column: ColumnType; sort: string }[]
}

/**
 * The grid's own list params. Grouped, the group fields sort first and every sort follows, since an explicit
 * sort list replaces the view's saved one; ungrouped, synced sorts and filters are left to the server.
 */
export function buildPrintListParams(
  query: PrintListQuery,
  { sortSync, filterSync }: { sortSync: boolean; filterSync: boolean },
) {
  const sortArr = query.groupBy.length
    ? [...query.groupBy.map((g) => ({ fk_column_id: g.column.id, direction: g.sort })), ...query.sorts]
    : sortSync
    ? null
    : query.sorts.filter((s) => !s.id)

  return {
    ...(sortArr ? { sortArrJson: stringifyFilterOrSortArr(sortArr) } : {}),
    ...(filterSync ? {} : { filterArrJson: stringifyFilterOrSortArr(query.nestedFilters.filter((f) => !f.id)) }),
    ...(query.where ? { where: query.where } : {}),
  }
}

/** Records to print, by position in the view: 1-based and inclusive. */
export interface PrintRange {
  start: number
  end: number
}

/** Keeps a range inside the view and within the per-print limit. */
export function clampPrintRange(range: Partial<PrintRange>, total: number, limit: number): PrintRange {
  const last = Math.max(total, 1)
  const start = Math.min(Math.max(Math.floor(range.start || 1), 1), last)
  const end = Math.min(Math.max(Math.floor(range.end || start), start), last, start + limit - 1)

  return { start, end }
}

/** A start typed past the end moves the end along, so the batch keeps its size. */
export function movePrintRangeStart(range: PrintRange, start: number, total: number, limit: number): PrintRange {
  const end = start > range.end ? start + range.end - range.start : range.end

  return clampPrintRange({ start, end }, total, limit)
}

/** When settings change the per-print limit, a range that filled the old limit fills the new one; a narrower range is only clamped. */
export function followPrintRangeLimit(range: PrintRange, prevLimit: number, limit: number, total: number): PrintRange {
  const wasFull = range.end - range.start + 1 === prevLimit

  return clampPrintRange(wasFull ? { start: range.start, end: range.start + limit - 1 } : range, total, limit)
}

/** Starts after the last printed batch, or from the top once the view has been printed through. */
export function getDefaultPrintRange(total: number, limit: number, lastPrintedEnd?: number | null): PrintRange {
  const start = lastPrintedEnd && lastPrintedEnd < total ? lastPrintedEnd + 1 : 1

  return clampPrintRange({ start, end: start + limit - 1 }, total, limit)
}

export function isFullPrintRange(range: PrintRange, total: number) {
  return range.start === 1 && range.end >= total
}

/** Becomes the browser's suggested PDF name, so each batch saves under its own name. */
export function getPrintDocumentTitle(title: string, range: PrintRange, total: number) {
  return isFullPrintRange(range, total) ? title : `${title} ${range.start}-${range.end}`
}

const PRINT_RANGE_STORAGE_PREFIX = 'nc-print-range-end:'

export function loadLastPrintedEnd(storageKey: string) {
  try {
    const value = Number(localStorage.getItem(PRINT_RANGE_STORAGE_PREFIX + storageKey))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function saveLastPrintedEnd(storageKey: string, end: number) {
  try {
    localStorage.setItem(PRINT_RANGE_STORAGE_PREFIX + storageKey, String(end))
  } catch {}
}
