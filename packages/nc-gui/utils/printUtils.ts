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

export const PRINT_PAGE_MARGIN_IN = 0.4

export const PRINT_ROW_NUMBER_WIDTH_PX = 40

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

export type PrintItem<Row> =
  | { type: 'group'; level: number; value: unknown; count: number }
  | { type: 'row'; row: Row; rowNumber: number }

/**
 * Flattens rows that are already sorted by the group fields into group headers and rows.
 * Row numbers restart in each innermost group, as in the grid.
 */
export function buildPrintItems<Row>(rows: Row[], groupValueGetters: ((row: Row) => unknown)[]): PrintItem<Row>[] {
  const items: PrintItem<Row>[] = []
  const openHeaders: { type: 'group'; level: number; value: unknown; count: number; key: string }[] = []
  let rowNumber = 0

  for (const row of rows) {
    const keys = groupValueGetters.map((getValue) => groupKey(getValue(row)))
    const firstChanged = keys.findIndex((key, level) => openHeaders[level]?.key !== key)

    if (firstChanged !== -1) {
      openHeaders.length = firstChanged
      for (let level = firstChanged; level < keys.length; level++) {
        const header = { type: 'group' as const, level, value: groupValueGetters[level]!(row), count: 0, key: keys[level]! }
        openHeaders.push(header)
        items.push(header)
      }
      rowNumber = 0
    }

    for (const header of openHeaders) header.count++

    items.push({ type: 'row', row, rowNumber: ++rowNumber })
  }

  return items.map((item) =>
    item.type === 'group' ? { type: 'group', level: item.level, value: item.value, count: item.count } : item,
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

/** Pages through `fetchPage` until every matching row, or `limit` rows, are loaded. */
export async function loadAllPrintRows(
  fetchPage: (offset: number, limit: number) => Promise<PrintRowsPage>,
  limit: number,
  pageSize: number,
) {
  const rows: Record<string, any>[] = []
  let total = 0

  while (rows.length < limit) {
    const { list, pageInfo } = await fetchPage(rows.length, Math.min(pageSize, limit - rows.length))

    rows.push(...list)
    total = pageInfo?.totalRows ?? rows.length

    if (!list.length || pageInfo?.isLastPage || rows.length >= total) break
  }

  return { rows, total: Math.max(total, rows.length) }
}
