<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  title?: string
  subtitle?: string | null
  /** Visible fields, in view order. */
  columns: ColumnType[]
  rows: Record<string, any>[]
  totalRows: number
  settings: PrintSettings
  /** Grid widths by column id; columns without one print at the default width. */
  columnWidths?: Record<string, string | number | undefined>
  /** Group fields, outermost first; rows must already be sorted by them. */
  groupColumns?: ColumnType[]
}

const props = withDefaults(defineProps<Props>(), {
  columnWidths: () => ({}),
  groupColumns: () => [],
})

const isTruncated = computed(() => props.totalRows > props.rows.length)

const fontSizePx = computed(() => PRINT_FONT_SIZES_PX[props.settings.fontSize])

const isFitToWidth = computed(() => props.settings.fieldSizing === 'fitToWidth')

const rowNumberWidth = computed(() => (props.settings.showRowNumbers ? PRINT_ROW_NUMBER_WIDTH_PX : 0))

const availableWidth = computed(() => getPrintableWidthPx(props.settings) - rowNumberWidth.value)

const columnsWithWidth = computed(() => {
  const columns = props.columns.map((column) => ({
    column,
    width: getPrintColumnWidthPx(props.columnWidths[column.id!], props.settings),
  }))

  return isFitToWidth.value
    ? fitPrintColumnWidths(columns, availableWidth.value)
    : capPrintColumnWidths(columns, availableWidth.value)
})

const bands = computed(() => splitPrintColumnBands(columnsWithWidth.value, availableWidth.value))

const widthById = computed(() => Object.fromEntries(columnsWithWidth.value.map(({ column, width }) => [column.id, width])))

const items = computed(() =>
  buildPrintItems(
    props.rows,
    props.groupColumns.map((column) => (row: Record<string, any>) => row[column.title!]),
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
      <div v-if="props.settings.showTitle" class="nc-print-view-header">
        <div class="nc-print-view-title">{{ props.title }}</div>
        <div class="nc-print-view-meta">
          <span v-if="props.subtitle">{{ props.subtitle }} · </span>
          {{ $t('labels.interfacePrintRecordCount', { count: props.totalRows }, props.totalRows) }}
        </div>
      </div>
      <div v-if="isTruncated" class="nc-print-view-meta nc-print-view-truncated">
        {{ $t('msg.info.interfacePrintTruncated', { limit: props.rows.length, total: props.totalRows }) }}
      </div>

      <table
        v-for="(band, bandIndex) in bands"
        :key="bandIndex"
        class="nc-print-view-table"
        :style="isFitToWidth ? { width: '100%' } : { width: `${bandWidth(band)}px` }"
      >
        <colgroup>
          <col v-if="props.settings.showRowNumbers" :style="{ width: `${rowNumberWidth}px` }" />
          <col v-for="column in band" :key="column.id" :style="columnStyle(column, band)" />
        </colgroup>
        <thead>
          <tr>
            <th v-if="props.settings.showRowNumbers" class="nc-print-view-index"></th>
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
                <span class="nc-print-view-group-count">{{ item.count }}</span>
              </td>
            </tr>
            <tr v-else>
              <td v-if="props.settings.showRowNumbers" class="nc-print-view-index">{{ item.rowNumber }}</td>
              <td v-for="column in band" :key="column.id">
                <div class="nc-print-view-cell">
                  <SmartsheetPlainCell :column="column" :model-value="item.row[column.title!]" />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
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
    color-scheme: light;
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

    .nc-print-view-truncated {
      margin-bottom: 8px;
    }

    .nc-print-view-table {
      max-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;

      & + .nc-print-view-table {
        break-before: page;
      }

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
      }

      .nc-print-view-heading,
      .nc-print-view-cell {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
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
  }
}
</style>
