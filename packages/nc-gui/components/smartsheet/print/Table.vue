<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  title?: string
  subtitle?: string | null
  /** Visible fields, in view order. */
  columns: ColumnType[]
  rows: Record<string, any>[]
  totalRows: number
  /** Position of the first printed row in the view, 1-based. */
  rangeStart?: number
  settings: PrintSettings
  /** Grid widths by column id; columns without one print at the default width. */
  columnWidths?: Record<string, string | number | undefined>
  /** Group fields, outermost first; rows must already be sorted by them. */
  groupColumns?: ColumnType[]
  /** The grid view's row height setting (0–3); rows print at least this tall. */
  rowHeight?: number | null
  /** Footer summary by column id, for the whole view; printed after the view's last record. */
  summary?: Record<string, { label: string; value: string }>
}

const props = withDefaults(defineProps<Props>(), {
  rangeStart: 1,
  columnWidths: () => ({}),
  groupColumns: () => [],
  rowHeight: null,
  summary: () => ({}),
})

const { t } = useI18n()

const range = computed<PrintRange>(() => ({
  start: props.rangeStart,
  end: props.rangeStart + Math.max(props.rows.length - 1, 0),
}))

const isPartial = computed(() => !isFullPrintRange(range.value, props.totalRows))

const recordSummary = computed(() =>
  isPartial.value
    ? t('labels.printSettings.recordRange', {
        start: range.value.start.toLocaleString(),
        end: range.value.end.toLocaleString(),
        total: props.totalRows.toLocaleString(),
      })
    : t('labels.interfacePrintRecordCount', { count: props.totalRows }, props.totalRows),
)

const fontSizePx = computed(() => PRINT_FONT_SIZES_PX[props.settings.fontSize])

const rowHeightPx = computed(() => getPrintRowHeightPx(props.rowHeight, props.settings))

// Taller rows show as many lines as fit, like the grid.
const isMultiline = computed(() => rowHeightPx.value > getPrintRowHeightPx(0, props.settings))

const cellStyle = computed(() => (props.settings.wrapText ? {} : { maxHeight: `${rowHeightPx.value - 9}px` }))

const showSummary = computed(() => range.value.end >= props.totalRows && Object.keys(props.summary).length > 0)

const isFitToWidth = computed(() => props.settings.fieldSizing === 'fitToWidth')

const layout = computed(() => getPrintColumnBands(props.columns, props.columnWidths, props.settings, range.value.end))

const rowNumberWidth = computed(() => layout.value.rowNumberWidth)

const columnsWithWidth = computed(() => layout.value.columnsWithWidth)

const bands = computed(() => layout.value.bands)

const widthById = computed(() => Object.fromEntries(columnsWithWidth.value.map(({ column, width }) => [column.id, width])))

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

function bandWidth(band: ColumnType[]) {
  return band.reduce((sum, column) => sum + (widthById.value[column.id!] ?? 0), rowNumberWidth.value)
}

function columnStyle(column: ColumnType, band: ColumnType[]) {
  const width = widthById.value[column.id!] ?? PRINT_DEFAULT_COLUMN_WIDTH_PX
  if (!isFitToWidth.value) return { width: `${width}px` }

  const total = bandWidth(band) - rowNumberWidth.value
  return { width: `${(width / total) * 100}%` }
}

function bandSpan(band: ColumnType[]) {
  return band.length + (props.settings.showRowNumbers ? 1 : 0)
}

let pageStyle: HTMLStyleElement | null = null

const pageTitle = document.title

document.title = getPrintDocumentTitle(props.title || pageTitle, range.value, props.totalRows)

watch(
  () => props.settings,
  (settings) => {
    if (!pageStyle) {
      pageStyle = document.createElement('style')
      pageStyle.dataset.ncPrintPage = ''
      document.head.appendChild(pageStyle)
    }
    pageStyle.textContent = getPrintPageCss(settings)
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  document.title = pageTitle
  pageStyle?.remove()
  pageStyle = null
})
</script>

<template>
  <Teleport to="body">
    <div
      class="nc-print-view"
      :class="{ 'nc-print-view-wrap': props.settings.wrapText }"
      :style="{ fontSize: `${fontSizePx}px` }"
      data-testid="nc-print-view"
    >
      <section v-for="(band, bandIndex) in bands" :key="bandIndex" class="nc-print-view-band">
        <div v-if="props.settings.showTitle" class="nc-print-view-header">
          <div class="nc-print-view-title">{{ props.title }}</div>
          <div class="nc-print-view-meta" data-testid="nc-print-view-records">
            <span v-if="props.subtitle">{{ props.subtitle }} · </span>
            {{ recordSummary }}
          </div>
        </div>
        <div v-else-if="isPartial" class="nc-print-view-meta nc-print-view-range" data-testid="nc-print-view-records">
          {{ recordSummary }}
        </div>
        <table
          class="nc-print-view-table"
          :class="{ 'nc-print-view-multiline': isMultiline }"
          :style="isFitToWidth ? { width: '100%' } : { width: `${bandWidth(band)}px` }"
        >
          <colgroup>
            <col v-if="props.settings.showRowNumbers" :style="{ width: `${rowNumberWidth}px` }" />
            <col v-for="column in band" :key="column.id" :style="columnStyle(column, band)" />
          </colgroup>
          <thead>
            <tr>
              <th v-if="props.settings.showRowNumbers" class="nc-print-view-index">#</th>
              <th v-for="column in band" :key="column.id">
                <div class="nc-print-view-heading">{{ column.title }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(item, index) in items" :key="index">
              <tr v-if="item.type === 'group'" class="nc-print-view-group" :data-level="item.level">
                <td :colspan="bandSpan(band)" :style="{ paddingLeft: `${6 + item.level * 16}px` }">
                  <span class="nc-print-view-group-field">{{ props.groupColumns[item.level]?.title }}</span>
                  <span
                    v-if="item.value === null || item.value === undefined || item.value === ''"
                    class="nc-print-view-group-empty"
                  >
                    {{ $t('general.empty') }}
                  </span>
                  <span v-else>
                    <SmartsheetPlainCell :column="props.groupColumns[item.level]!" :model-value="item.value" />
                  </span>
                  <span class="nc-print-view-group-count">{{ item.partial ? `${item.count}+` : item.count }}</span>
                </td>
              </tr>
              <tr v-else :style="{ height: `${rowHeightPx}px` }">
                <td v-if="props.settings.showRowNumbers" class="nc-print-view-index">{{ item.rowNumber }}</td>
                <td v-for="column in band" :key="column.id">
                  <div class="nc-print-view-cell" :style="cellStyle">
                    <SmartsheetPrintCell :column="column" :model-value="item.row[column.title!]" />
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="showSummary" class="nc-print-view-summary" data-testid="nc-print-view-summary">
              <td v-if="props.settings.showRowNumbers" class="nc-print-view-index"></td>
              <td v-for="column in band" :key="column.id">
                <template v-if="props.summary[column.id!]">
                  <span class="nc-print-view-summary-label">{{ props.summary[column.id!]!.label }}</span>
                  {{ props.summary[column.id!]!.value }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </Teleport>
</template>

<style lang="scss">
@media screen {
  .nc-print-view {
    display: none;
  }
}

@media print {
  // This stylesheet stays loaded after unmount, so only hide the app while the print view is mounted.
  body:has(> .nc-print-view) > *:not(.nc-print-view) {
    display: none !important;
  }

  html:has(> body > .nc-print-view),
  body:has(> .nc-print-view) {
    height: auto !important;
    overflow: visible !important;
    // The app theme (e.g. dark) sets the page background, which would print behind the dark text.
    background: #fff !important;
    // The dark theme sets `color-scheme: dark` inline on <html>, which would darken the page margins.
    color-scheme: light !important;
  }

  .nc-print-view {
    color: #1f293a;
    line-height: 1.4;

    .nc-print-view-header {
      margin-bottom: 12px;
    }

    .nc-print-view-title {
      font-size: 1.5em;
      font-weight: 700;
    }

    .nc-print-view-meta {
      color: #4a5268;
      margin-top: 2px;
    }

    .nc-print-view-range {
      margin-bottom: 8px;
    }

    // Each band of columns starts a new page under the view title, like the first.
    .nc-print-view-band + .nc-print-view-band {
      break-before: page;
    }

    .nc-print-view-table {
      max-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;

      thead {
        display: table-header-group;
      }

      tr {
        break-inside: avoid;
      }

      th,
      td {
        border: 1px solid #d5dce8;
        padding: 4px 6px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #f4f4f5;
        font-weight: 600;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .nc-print-view-index {
        color: #6a7184;
        text-align: center;
        white-space: nowrap;
      }

      // Headings wrap at spaces, like the grid's; a word wider than the column is cut off.
      .nc-print-view-heading {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .nc-print-view-cell {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      &.nc-print-view-multiline .nc-print-view-cell {
        white-space: pre-line;
        overflow-wrap: anywhere;
      }

      .nc-print-view-summary td {
        text-align: right;
        font-weight: 600;
        white-space: nowrap;
        border-top-width: 2px;
      }

      .nc-print-view-summary-label {
        color: #6a7184;
        font-size: 0.85em;
        font-weight: 500;
        text-transform: uppercase;
        margin-right: 4px;
      }

      .nc-print-view-group td {
        background: #f9f9fa;
        font-weight: 600;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        break-after: avoid;

        > span + * {
          margin-left: 6px;
        }
      }

      .nc-print-view-group-field {
        color: #6a7184;
        font-weight: 500;
      }

      .nc-print-view-group-empty {
        color: #6a7184;
        font-style: italic;
      }

      .nc-print-view-group-count {
        color: #6a7184;
        font-weight: 500;
      }
    }

    // PlainCell's empty separator is an inline-block that a wrapping line can break after.
    .plain-cell::before {
      display: none !important;
    }

    &.nc-print-view-wrap .nc-print-view-cell {
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .nc-print-cell-numeric {
      text-align: right;
    }

    .nc-print-cell-select,
    .nc-print-cell-user,
    .nc-print-cell-records {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .nc-print-view-table:not(.nc-print-view-multiline) .nc-print-cell-select,
    .nc-print-view-table:not(.nc-print-view-multiline) .nc-print-cell-user,
    .nc-print-view-table:not(.nc-print-view-multiline) .nc-print-cell-records {
      flex-wrap: nowrap;
    }

    .nc-print-chip {
      display: inline-block;
      padding: 0 8px;
      border-radius: 999px;
      background: #e7e7e9;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .nc-print-chip-user {
      background: #f0f0f2;
      border: 1px solid #e1e3e6;
    }

    .nc-print-chip-record {
      background: #e7eefc;
      color: #2e4ba6;
      border-radius: 4px;
    }

    .nc-print-cell-link {
      color: #3366ff;
      text-decoration: underline;
    }

    .nc-print-cell-colour-value {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .nc-print-cell-swatch {
      width: 16px;
      height: 16px;
      flex: none;
      border: 1px solid rgba(0, 0, 0, 0.1);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .nc-print-cell-button {
      text-align: center;
    }

    .nc-print-button {
      display: inline-block;
      padding: 0 10px;
      border-radius: 6px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .nc-print-button-solid {
      background: #3366ff;
      color: #fff;
    }

    .nc-print-button-light {
      background: #ebf0ff;
      color: #2952cc;
    }

    .nc-print-button-text {
      color: #2952cc;
    }

    .nc-print-cell-checkbox {
      text-align: center;
    }

    .nc-print-cell-stars {
      letter-spacing: 1px;
    }

    .nc-print-cell-rich {
      white-space: normal;

      p,
      ul,
      ol {
        margin: 0;
      }

      ul,
      ol {
        padding-left: 1.2em;
      }

      ul {
        list-style: disc;
      }

      ol {
        list-style: decimal;
      }

      code {
        font-family: monospace;
        background: #f4f4f5;
        padding: 0 2px;
      }
    }
  }
}
</style>
