<script setup lang="ts">
// Experimental: draws print pages with the grid's canvas cell renderers into vector SVG,
// so every field prints exactly as the grid shows it.
import { type ColumnType, type TableType, UITypes, isLTAR, isRichText, isSmartText } from 'nocodb-sdk'
import { Context as SvgContext } from 'svgcanvas'
import { useGridCellHandler } from '../grid/canvas/cells'
import type { ActionManager } from '../grid/canvas/loaders/ActionManager'
import { SpriteLoader } from '../grid/canvas/loaders/SpriteLoader'
import { ImageWindowLoader } from '../grid/canvas/loaders/ImageLoader'
import { MarkdownLoader } from '../grid/canvas/loaders/markdownLoader'
import { TableMetaLoader } from '../grid/canvas/loaders/TableMetaLoader'
import { renderMultiLineText, renderSingleLineText } from '../grid/canvas/utils/canvas'

interface Props {
  title?: string
  subtitle?: string | null
  columns: ColumnType[]
  rows: Record<string, any>[]
  totalRows: number
  rangeStart?: number
  settings: PrintSettings
  columnWidths?: Record<string, string | number | undefined>
  /** Group fields, outermost first; rows must already be sorted by them. */
  groupColumns?: ColumnType[]
  /** The grid view's row height setting (0–3). */
  rowHeight?: number | null
  /** Footer summary by column id, for the whole view; printed after the view's last record. */
  summary?: PrintSummary
}

const props = withDefaults(defineProps<Props>(), {
  rangeStart: 1,
  columnWidths: () => ({}),
  groupColumns: () => [],
  rowHeight: null,
  summary: () => ({}),
})

const emit = defineEmits<{ ready: [] }>()

const { t } = useI18n()

const { meta } = useSmartsheetStoreOrThrow()

const { getMeta, metas } = useMetas()

const { forcedTheme, clearColorCache } = useTheme()

const pages = ref<string[]>([])

const containerRef = ref<HTMLElement>()

// The grid draws at 13px; the whole page is scaled to the chosen font size.
const GRID_FONT_SIZE_PX = 13
const HEADER_HEIGHT = 32
const TITLE_HEIGHT = 52
// Images, icons and rich text load asynchronously; wait at most this long for them.
const LOADER_TIMEOUT_MS = 3000

const scale = computed(() => PRINT_FONT_SIZES_PX[props.settings.fontSize] / GRID_FONT_SIZE_PX)

let lastLoadAt = 0

function onLoaderSettled() {
  lastLoadAt = Date.now()
}

const spriteLoader = new SpriteLoader(onLoaderSettled)
const imageLoader = new ImageWindowLoader(onLoaderSettled)
const markdownLoader = new MarkdownLoader(onLoaderSettled)
const tableMetaLoader = new TableMetaLoader(getMeta, onLoaderSettled, meta.value?.base_id)

// Print cells are read-only: no actions, edits or cursor changes.
const noopActionManager = new Proxy({}, { get: () => () => undefined }) as ActionManager

const { renderCell } = useGridCellHandler({
  getCellPosition: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  actionManager: noopActionManager,
  markdownLoader,
  makeCellEditable: () => {},
  updateOrSaveRow: async () => {},
  meta: meta as Ref<TableType>,
  hasEditPermission: computed(() => false),
  setCursor: () => {},
  attachmentCellDropOver: ref(null),
})

function relatedMeta(column: ColumnType) {
  const baseId = meta.value?.base_id
  const options = column.colOptions as {
    fk_relation_column_id?: string
    fk_related_model_id?: string
    fk_related_base_id?: string
  }

  if (column.uidt === UITypes.Lookup || column.uidt === UITypes.Rollup) {
    const relatedColObj = (metas.value?.[`${baseId}:${column.fk_model_id}`]?.columns as ColumnType[] | undefined)?.find(
      (c) => c.id === options?.fk_relation_column_id,
    )
    const relOptions = relatedColObj?.colOptions as { fk_related_model_id?: string; fk_related_base_id?: string } | undefined
    return {
      relatedColObj,
      relatedTableMeta: relOptions?.fk_related_model_id
        ? metas.value?.[`${relOptions.fk_related_base_id || baseId}:${relOptions.fk_related_model_id}`]
        : undefined,
    }
  }

  if (isLTAR(column.uidt, column.colOptions) && options?.fk_related_model_id) {
    return { relatedTableMeta: metas.value?.[`${options.fk_related_base_id || baseId}:${options.fk_related_model_id}`] }
  }

  return {}
}

const layout = computed(() =>
  getPrintColumnBands(props.columns, props.columnWidths, props.settings, props.rangeStart + props.rows.length - 1),
)

const pageWidth = computed(() => getPrintableWidthPx(props.settings))

const pageHeight = computed(() => getPrintableHeightPx(props.settings))

const range = computed<PrintRange>(() => ({
  start: props.rangeStart,
  end: props.rangeStart + Math.max(props.rows.length - 1, 0),
}))

const recordSummary = computed(() =>
  isFullPrintRange(range.value, props.totalRows)
    ? t('labels.interfacePrintRecordCount', { count: props.totalRows }, props.totalRows)
    : t('labels.printSettings.recordRange', {
        start: range.value.start.toLocaleString(),
        end: range.value.end.toLocaleString(),
        total: props.totalRows.toLocaleString(),
      }),
)

const items = computed(() =>
  buildPrintItems(
    props.rows,
    props.groupColumns.map((column) => (row: Record<string, any>) => row[column.title!]),
    {
      firstRowNumber: props.rangeStart,
      cutBefore: range.value.start > 1,
      cutAfter: range.value.end < props.totalRows,
    },
  ),
)

const showSummary = computed(() => range.value.end >= props.totalRows && Object.keys(props.summary).length > 0)

/** One printed line of a band, in grid units (unscaled). */
type PageLine =
  | { type: 'group'; item: Extract<PrintItem<Record<string, any>>, { type: 'group' }>; height: number }
  | { type: 'row'; row: Record<string, any>; rowNumber: number | null; height: number }
  | { type: 'summary'; height: number }

interface LinkArea {
  x: number
  y: number
  width: number
  height: number
  href: string
}

const LINK_TYPES = [UITypes.URL, UITypes.Email, UITypes.PhoneNumber]

const LINE_HEIGHT = 16

const CELL_PADDING = 10

let measureContext: CanvasRenderingContext2D | null = null

function measureLines(text: string, width: number) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext || !text) return 1

  measureContext.font = '500 13px Inter'
  let lines = 0
  for (const paragraph of text.split('\n')) {
    let line = ''
    lines++
    for (const word of paragraph.split(/(\s+)/)) {
      const next = line + word
      if (line && measureContext.measureText(next).width > width) {
        lines++
        line = word.trimStart()
      } else {
        line = next
      }
    }
  }
  return lines
}

function baseRowHeight() {
  return getPrintRowHeightPx(props.rowHeight, props.settings) / scale.value
}

/** Wrap long text: a row grows to fit its longest Long Text value (the grid wraps only those), up to most of a page. */
function rowHeightFor(row: Record<string, any>, band: ColumnType[], widthById: Record<string, number>) {
  const base = baseRowHeight()
  if (!props.settings.wrapText) return base

  const maxHeight = (pageHeight.value / scale.value) * 0.8
  let lines = 1
  for (const column of band) {
    const value = row[column.title!]
    if (value === null || value === undefined || value === '' || column.uidt !== UITypes.LongText) continue
    lines = Math.max(lines, measureLines(String(value), (widthById[column.id!] ?? 200) - CELL_PADDING * 2))
  }
  return Math.min(maxHeight, Math.max(base, lines * LINE_HEIGHT + CELL_PADDING))
}

function isWrappedText(column: ColumnType, value: unknown) {
  return (
    props.settings.wrapText &&
    column.uidt === UITypes.LongText &&
    !isRichText(column) &&
    !isSmartText(column) &&
    value !== null &&
    value !== undefined &&
    value !== ''
  )
}

function linkHref(column: ColumnType, value: any) {
  if (value === null || value === undefined || value === '') return null

  if (column.uidt === UITypes.Button) {
    const url = typeof value?.url === 'string' ? value.url.trim() : ''
    if (!url) return null
    return /^https?:\/\//i.test(url) ? url : `https://${url}`
  }

  const text = String(value).trim()
  if (column.uidt === UITypes.Email) return `mailto:${text}`
  if (column.uidt === UITypes.PhoneNumber) return `tel:${text.replace(/[^\d+]/g, '')}`
  const url = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`
  return /^https?:/i.test(url) ? url : null
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function drawTitle(ctx: CanvasRenderingContext2D) {
  renderSingleLineText(ctx, { x: 0, y: 4, py: 0, text: props.title ?? '', fontFamily: '700 20px Inter', fillStyle: '#1f293a' })
  renderSingleLineText(ctx, {
    x: 0,
    y: 30,
    py: 0,
    text: props.subtitle ? `${props.subtitle} · ${recordSummary.value}` : recordSummary.value,
    fontFamily: '500 12px Inter',
    fillStyle: '#4a5268',
  })
}

function drawPage(
  ctx: CanvasRenderingContext2D,
  band: ColumnType[],
  widthById: Record<string, number>,
  lines: PageLine[],
  withTitle: boolean,
  links: LinkArea[],
) {
  const k = scale.value
  const rowNumberWidth = layout.value.rowNumberWidth / k

  ctx.setTransform(k, 0, 0, k, 0, 0)

  let y = 0
  if (withTitle) {
    drawTitle(ctx)
    y = TITLE_HEIGHT
  }

  const cells: { width: number; column?: ColumnType }[] = [
    ...(props.settings.showRowNumbers ? [{ width: rowNumberWidth }] : []),
    ...band.map((column) => ({ width: widthById[column.id!] ?? 200, column })),
  ]
  const tableWidth = cells.reduce((sum, cell) => sum + cell.width, 0)

  ctx.fillStyle = '#f4f4f5'
  ctx.fillRect(0, y, tableWidth, HEADER_HEIGHT)
  let x = 0
  for (const cell of cells) {
    renderSingleLineText(ctx, {
      x: x + 8,
      y,
      text: cell.column ? cell.column.title! : '#',
      maxWidth: cell.width - 16,
      fontFamily: '600 13px Inter',
      fillStyle: '#374151',
      height: HEADER_HEIGHT,
    })
    ctx.strokeStyle = '#d5dce8'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, cell.width, HEADER_HEIGHT)
    x += cell.width
  }
  y += HEADER_HEIGHT

  for (const line of lines) {
    if (line.type === 'group') {
      const { item } = line
      const groupColumn = props.groupColumns[item.level]
      ctx.fillStyle = '#f9f9fa'
      ctx.fillRect(0, y, tableWidth, line.height)
      ctx.strokeStyle = '#d5dce8'
      ctx.strokeRect(0.5, y + 0.5, tableWidth, line.height)

      const indent = 8 + item.level * 16
      const label = renderSingleLineText(ctx, {
        x: indent,
        y,
        text: groupColumn?.title ?? '',
        fontFamily: '500 12px Inter',
        fillStyle: '#6a7184',
        height: line.height,
      })
      const valueX = indent + label.width + 8
      const isEmpty = item.value === null || item.value === undefined || item.value === ''
      if (isEmpty) {
        renderSingleLineText(ctx, {
          x: valueX,
          y,
          text: t('general.empty'),
          fontFamily: 'italic 500 13px Inter',
          fillStyle: '#6a7184',
          height: line.height,
        })
      } else if (groupColumn) {
        const valueWidth = Math.min(240, tableWidth - valueX - 60)
        renderCell(ctx, groupColumn, {
          value: item.value,
          row: { [groupColumn.title!]: item.value },
          x: valueX - CELL_PADDING,
          y,
          width: valueWidth + CELL_PADDING,
          height: line.height,
          readonly: true,
          spriteLoader,
          imageLoader,
          markdownLoader,
          tableMetaLoader,
          ...relatedMeta(groupColumn),
          rowMeta: {},
          mousePosition: { x: -1, y: -1 },
          isGroupHeader: true,
        })
      }
      renderSingleLineText(ctx, {
        x: tableWidth - 8,
        y,
        text: item.partial ? `${item.count}+` : String(item.count),
        textAlign: 'right',
        fontFamily: '600 12px Inter',
        fillStyle: '#6a7184',
        height: line.height,
      })
    } else if (line.type === 'row') {
      let cx = 0
      for (const cell of cells) {
        if (!cell.column) {
          if (line.rowNumber !== null) {
            renderSingleLineText(ctx, {
              x: cx + 8,
              y,
              text: String(line.rowNumber),
              maxWidth: cell.width - 12,
              fontFamily: '500 12px Inter',
              fillStyle: '#6a7184',
              height: Math.min(line.height, HEADER_HEIGHT),
            })
          }
        } else {
          const value = line.row[cell.column.title!]
          if (isWrappedText(cell.column, value)) {
            // The grid's renderer caps lines at its row-height tiers; wrapped rows can be taller.
            renderMultiLineText(ctx, {
              x: cx + CELL_PADDING,
              y,
              text: String(value),
              maxWidth: cell.width - CELL_PADDING * 2,
              fontFamily: '500 13px Inter',
              fillStyle: '#1f293a',
              height: line.height,
              maxLines: Math.max(1, Math.floor((line.height - CELL_PADDING) / LINE_HEIGHT)),
              lineHeight: LINE_HEIGHT,
              renderAsPreTag: true,
            })
          } else
            renderCell(ctx, cell.column, {
              value,
              row: line.row,
              x: cx,
              y,
              width: cell.width,
              height: line.height,
              pv: false,
              readonly: true,
              spriteLoader,
              imageLoader,
              markdownLoader,
              tableMetaLoader,
              ...relatedMeta(cell.column),
              rowMeta: {},
              mousePosition: { x: -1, y: -1 },
              isRootCell: true,
            })
          if (LINK_TYPES.includes(cell.column.uidt as UITypes) || cell.column.uidt === UITypes.Button) {
            const href = linkHref(cell.column, value)
            if (href)
              links.push({ x: cx * k, y: y * k, width: cell.width * k, height: Math.min(line.height, HEADER_HEIGHT) * k, href })
          }
        }
        ctx.strokeStyle = '#d5dce8'
        ctx.strokeRect(cx + 0.5, y + 0.5, cell.width, line.height)
        cx += cell.width
      }
    } else {
      let cx = 0
      ctx.strokeStyle = '#d5dce8'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, y + 1)
      ctx.lineTo(tableWidth, y + 1)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, y + 0.5, tableWidth, line.height)
      for (const cell of cells) {
        const summary = cell.column ? props.summary[cell.column.id!] : undefined
        if (summary) {
          const value = renderSingleLineText(ctx, {
            x: cx + cell.width - 8,
            y,
            text: summary.value,
            textAlign: 'right',
            fontFamily: '600 13px Inter',
            fillStyle: '#1f293a',
            height: line.height,
          })
          renderSingleLineText(ctx, {
            x: cx + cell.width - 14 - value.width,
            y,
            text: summary.label.toUpperCase(),
            textAlign: 'right',
            fontFamily: '500 11px Inter',
            fillStyle: '#6a7184',
            height: line.height,
          })
        }
        cx += cell.width
      }
    }
    y += line.height
  }
}

/** Splits a band's lines into pages; the first page of each band carries the title. */
function paginate(lines: PageLine[]) {
  const available = pageHeight.value / scale.value
  const pages: { lines: PageLine[]; withTitle: boolean }[] = []
  let current: PageLine[] = []
  let used = HEADER_HEIGHT + (props.settings.showTitle ? TITLE_HEIGHT : 0)
  let withTitle = props.settings.showTitle

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    // Keep a group header with the line after it.
    const needed = line.height + (line.type === 'group' ? lines[i + 1]?.height ?? 0 : 0)
    if (current.length && used + needed > available) {
      pages.push({ lines: current, withTitle })
      current = []
      used = HEADER_HEIGHT
      withTitle = false
    }
    current.push(line)
    used += line.height
  }
  if (current.length || !pages.length) pages.push({ lines: current, withTitle })
  return pages
}

function bandLines(band: ColumnType[], widthById: Record<string, number>): PageLine[] {
  const lines: PageLine[] = items.value.map((item) =>
    item.type === 'group'
      ? { type: 'group', item, height: HEADER_HEIGHT }
      : { type: 'row', row: item.row, rowNumber: item.rowNumber, height: rowHeightFor(item.row, band, widthById) },
  )
  if (showSummary.value) lines.push({ type: 'summary', height: HEADER_HEIGHT })
  return lines
}

// Done once no load has finished for a moment, or after the timeout.
async function waitForLoaders() {
  const started = Date.now()
  lastLoadAt = started
  while (Date.now() - lastLoadAt < 300 && Date.now() - started < LOADER_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const objectUrls: string[] = []

/** Identical icons and images are emitted once, so repeated checkboxes or stars don't bloat the PDF. */
async function dedupeImages(svgs: string[]) {
  const urls = new Map<string, string>()
  for (const svg of svgs) {
    for (const match of svg.matchAll(/href="(data:image\/[^"]+)"/g)) {
      if (!urls.has(match[1]!)) urls.set(match[1]!, '')
    }
  }
  for (const dataUrl of urls.keys()) {
    try {
      urls.set(dataUrl, URL.createObjectURL(await (await fetch(dataUrl)).blob()))
    } catch {
      urls.set(dataUrl, dataUrl)
    }
  }
  objectUrls.push(...[...urls.values()].filter((url) => url.startsWith('blob:')))
  return svgs.map((svg) => svg.replace(/href="(data:image\/[^"]+)"/g, (_, dataUrl: string) => `href="${urls.get(dataUrl)}"`))
}

async function render() {
  const k = scale.value
  const output: string[] = []
  const widthById = Object.fromEntries(layout.value.columnsWithWidth.map(({ column, width }) => [column.id, width / k]))
  const bands = layout.value.bands.map((band) => ({ band, pages: paginate(bandLines(band, widthById)) }))

  // The grid's renderers pick colours from the active theme; print is always light.
  const previousTheme = forcedTheme.value
  forcedTheme.value = 'light'
  await nextTick()
  clearColorCache()

  try {
    // A first pass starts the image, icon and rich text loads; the real pass draws them.
    const warmup = new SvgContext({ width: pageWidth.value, height: pageHeight.value })
    for (const { band, pages } of bands) {
      for (const page of pages)
        drawPage(warmup as unknown as CanvasRenderingContext2D, band, widthById, page.lines, page.withTitle, [])
    }
    await waitForLoaders()

    for (const { band, pages } of bands) {
      for (const page of pages) {
        const ctx = new SvgContext({ width: pageWidth.value, height: pageHeight.value })
        const links: LinkArea[] = []
        drawPage(ctx as unknown as CanvasRenderingContext2D, band, widthById, page.lines, page.withTitle, links)
        const anchors = links
          .map(
            (link) =>
              `<a href="${escapeAttr(link.href)}" target="_blank"><rect x="${link.x}" y="${link.y}" width="${
                link.width
              }" height="${link.height}" fill="transparent"/></a>`,
          )
          .join('')
        output.push(ctx.getSerializedSvg().replace(/<\/svg>\s*$/, `${anchors}</svg>`))
      }
    }
  } finally {
    forcedTheme.value = previousTheme
    await nextTick()
    clearColorCache()
  }

  pages.value = await dedupeImages(output)
  await nextTick()
  await waitForImages()
  emit('ready')
}

const IMAGE_TIMEOUT_MS = 15000

/**
 * Icons, barcodes, QR codes and attachments are `<image>` elements that load asynchronously.
 * The print dialog snapshots the page at once, so every image has to have loaded first.
 */
async function waitForImages() {
  const images = [...(containerRef.value?.querySelectorAll('image') ?? [])]
  if (!images.length) return

  const loads = images.map(
    (image) =>
      new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      }),
  )
  await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, IMAGE_TIMEOUT_MS))])
  // Let the loaded images paint before the dialog takes its snapshot.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

const pageStyle = document.createElement('style')

pageStyle.textContent = getPrintPageCss(props.settings)

const pageTitle = document.title

document.title = getPrintDocumentTitle(props.title || pageTitle, range.value, props.totalRows)

onMounted(() => {
  document.head.appendChild(pageStyle)
  render()
})

onBeforeUnmount(() => {
  pageStyle.remove()
  document.title = pageTitle
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <Teleport to="body">
    <div ref="containerRef" class="nc-print-view nc-print-svg-pages" data-testid="nc-print-view">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-for="(svg, index) in pages" :key="index" class="nc-print-svg-page" v-html="svg" />
    </div>
  </Teleport>
</template>

<style lang="scss">
@media screen {
  // Rendered but out of sight: images inside `display: none` don't load until printing starts,
  // and the print dialog would snapshot them blank.
  .nc-print-svg-pages {
    position: fixed;
    top: 0;
    left: -100000px;
    pointer-events: none;
  }
}

@media print {
  body:has(> .nc-print-svg-pages) > *:not(.nc-print-svg-pages) {
    display: none !important;
  }

  html:has(> body > .nc-print-svg-pages),
  body:has(> .nc-print-svg-pages) {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
    // The dark theme sets `color-scheme: dark` inline on <html>, which would darken the page margins.
    color-scheme: light !important;
  }

  .nc-print-svg-pages .nc-print-svg-page {
    break-after: page;

    svg {
      display: block;
    }
  }
}
</style>
