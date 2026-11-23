<script setup lang="ts">
// Experimental: draws print pages with the grid's canvas cell renderers into vector SVG,
// so every field prints exactly as the grid shows it.
import { type ColumnType, type TableType, UITypes, isLTAR } from 'nocodb-sdk'
import { Context as SvgContext } from 'svgcanvas'
import { useGridCellHandler } from '../grid/canvas/cells'
import type { ActionManager } from '../grid/canvas/loaders/ActionManager'
import { SpriteLoader } from '../grid/canvas/loaders/SpriteLoader'
import { ImageWindowLoader } from '../grid/canvas/loaders/ImageLoader'
import { MarkdownLoader } from '../grid/canvas/loaders/markdownLoader'
import { TableMetaLoader } from '../grid/canvas/loaders/TableMetaLoader'
import { renderSingleLineText } from '../grid/canvas/utils/canvas'

interface Props {
  title?: string
  columns: ColumnType[]
  rows: Record<string, any>[]
  totalRows: number
  rangeStart?: number
  settings: PrintSettings
  columnWidths?: Record<string, string | number | undefined>
  rowHeight?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  rangeStart: 1,
  columnWidths: () => ({}),
  rowHeight: null,
})

const emit = defineEmits<{ ready: [] }>()

const { t } = useI18n()

const { meta } = useSmartsheetStoreOrThrow()

const { getMeta, metas } = useMetas()

const pages = ref<string[]>([])

// The grid draws at 13px; the whole page is scaled to the chosen font size.
const GRID_FONT_SIZE_PX = 13
const HEADER_HEIGHT = 32
const TITLE_HEIGHT = 44
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

const recordSummary = computed(() => {
  const end = props.rangeStart + Math.max(props.rows.length - 1, 0)
  return isFullPrintRange({ start: props.rangeStart, end }, props.totalRows)
    ? t('labels.interfacePrintRecordCount', { count: props.totalRows }, props.totalRows)
    : t('labels.printSettings.recordRange', {
        start: props.rangeStart.toLocaleString(),
        end: end.toLocaleString(),
        total: props.totalRows.toLocaleString(),
      })
})

function drawPage(ctx: CanvasRenderingContext2D, band: ColumnType[], rows: Record<string, any>[], firstIndex: number) {
  const k = scale.value
  const widthById = Object.fromEntries(layout.value.columnsWithWidth.map(({ column, width }) => [column.id, width / k]))
  const rowNumberWidth = layout.value.rowNumberWidth / k
  const rowHeight = getPrintRowHeightPx(props.rowHeight, props.settings) / k

  ctx.setTransform(k, 0, 0, k, 0, 0)

  let y = 0

  if (props.settings.showTitle) {
    renderSingleLineText(ctx, {
      x: 0,
      y: 0,
      text: props.title ?? '',
      fontFamily: '700 20px Inter',
      fillStyle: '#1f293a',
      height: 26,
    })
    renderSingleLineText(ctx, {
      x: 0,
      y: 24,
      text: recordSummary.value,
      fontFamily: '500 12px Inter',
      fillStyle: '#4a5268',
      height: 16,
    })
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
    x += cell.width
  }

  ctx.strokeStyle = '#d5dce8'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, y + 0.5, tableWidth, HEADER_HEIGHT)
  y += HEADER_HEIGHT

  rows.forEach((row, index) => {
    let cx = 0
    for (const cell of cells) {
      if (!cell.column) {
        renderSingleLineText(ctx, {
          x: cx + 8,
          y,
          text: String(firstIndex + index),
          maxWidth: cell.width - 12,
          fontFamily: '500 12px Inter',
          fillStyle: '#6a7184',
          height: Math.min(rowHeight, 32),
        })
      } else {
        renderCell(ctx, cell.column, {
          value: row[cell.column.title!],
          row,
          x: cx,
          y,
          width: cell.width,
          height: rowHeight,
          pv: false,
          readonly: true,
          spriteLoader,
          imageLoader,
          markdownLoader,
          tableMetaLoader,
          ...relatedMeta(cell.column),
          rowMeta: { rowIndex: index },
          mousePosition: { x: -1, y: -1 },
          pk: String(firstIndex + index),
          isRootCell: true,
        })
      }
      ctx.strokeStyle = '#d5dce8'
      ctx.strokeRect(cx + 0.5, y + 0.5, cell.width, rowHeight)
      cx += cell.width
    }
    y += rowHeight
  })
}

function rowsPerPage() {
  const k = scale.value
  const rowHeight = getPrintRowHeightPx(props.rowHeight, props.settings)
  const fixed = (HEADER_HEIGHT + (props.settings.showTitle ? TITLE_HEIGHT : 0)) * k
  return Math.max(1, Math.floor((pageHeight.value - fixed) / rowHeight))
}

// Done once no load has finished for a moment, or after the timeout.
async function waitForLoaders() {
  const started = Date.now()
  lastLoadAt = started
  while (Date.now() - lastLoadAt < 300 && Date.now() - started < LOADER_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

async function render() {
  const perPage = rowsPerPage()
  const svgs: string[] = []

  // A first pass starts the image, icon and rich text loads; the real pass draws them.
  const warmup = new SvgContext({ width: pageWidth.value, height: pageHeight.value })
  for (const band of layout.value.bands)
    drawPage(warmup as unknown as CanvasRenderingContext2D, band, props.rows.slice(0, perPage), props.rangeStart)
  await waitForLoaders()

  for (const band of layout.value.bands) {
    for (let start = 0; start < props.rows.length; start += perPage) {
      const ctx = new SvgContext({ width: pageWidth.value, height: pageHeight.value })
      drawPage(
        ctx as unknown as CanvasRenderingContext2D,
        band,
        props.rows.slice(start, start + perPage),
        props.rangeStart + start,
      )
      svgs.push(ctx.getSerializedSvg())
    }
  }

  pages.value = svgs
  await nextTick()
  emit('ready')
}

const pageStyle = document.createElement('style')

pageStyle.textContent = getPrintPageCss(props.settings)

onMounted(() => {
  document.head.appendChild(pageStyle)
  render()
})

onBeforeUnmount(() => pageStyle.remove())
</script>

<template>
  <Teleport to="body">
    <div class="nc-print-view nc-print-svg-pages" data-testid="nc-print-view">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-for="(svg, index) in pages" :key="index" class="nc-print-svg-page" v-html="svg" />
    </div>
  </Teleport>
</template>

<style lang="scss">
@media screen {
  .nc-print-svg-pages {
    display: none;
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
  }

  .nc-print-svg-pages .nc-print-svg-page {
    break-after: page;

    svg {
      display: block;
    }
  }
}
</style>
