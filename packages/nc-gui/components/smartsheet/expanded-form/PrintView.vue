<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'

interface Props {
  title?: string
  meta?: TableType
  columns: ColumnType[]
  row: Record<string, any>
}

const props = defineProps<Props>()
</script>

<template>
  <Teleport to="body">
    <div class="nc-expanded-form-print" data-testid="nc-expanded-form-print-view">
      <div class="nc-expanded-form-print-header">
        <div class="nc-expanded-form-print-title">{{ props.title }}</div>
        <div v-if="props.meta?.title" class="nc-expanded-form-print-meta">{{ props.meta.title }}</div>
      </div>

      <table class="nc-expanded-form-print-table">
        <tbody>
          <tr v-for="column in props.columns" :key="column.id">
            <th>{{ column.title }}</th>
            <td>
              <SmartsheetPlainCell :column="column" :model-value="props.row[column.title!]" :meta="props.meta" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Teleport>
</template>

<style lang="scss">
@media screen {
  .nc-expanded-form-print {
    display: none;
  }
}

@media print {
  // This stylesheet stays loaded after unmount, so only hide the app while the print view is mounted.
  body:has(> .nc-expanded-form-print) > *:not(.nc-expanded-form-print) {
    display: none !important;
  }

  html:has(> body > .nc-expanded-form-print),
  body:has(> .nc-expanded-form-print) {
    height: auto !important;
    overflow: visible !important;
    // The app theme (e.g. dark) sets the page background, which would print behind the dark text.
    background: #fff !important;
    color-scheme: light;
  }

  .nc-expanded-form-print {
    color: #1f293a;
    font-size: 12px;

    .nc-expanded-form-print-header {
      margin-bottom: 16px;
    }

    .nc-expanded-form-print-title {
      font-size: 20px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .nc-expanded-form-print-meta {
      color: #4a5268;
      margin-top: 2px;
    }

    .nc-expanded-form-print-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;

      tr {
        break-inside: avoid;
      }

      th,
      td {
        border-bottom: 1px solid #d5dce8;
        padding: 6px 8px;
        text-align: left;
        vertical-align: top;
        overflow-wrap: anywhere;
      }

      th {
        width: 30%;
        color: #4a5268;
        font-weight: 600;
      }

      // Long text prints in full, keeping its line breaks.
      td {
        white-space: pre-wrap;
      }
    }
  }
}
</style>
