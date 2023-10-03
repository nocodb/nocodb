<script setup lang="ts">
import type { RequestParams } from 'nocodb-sdk'
import { ExportTypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsPublicInj,
  MetaInj,
  extractSdkResponseErrorMsg,
  iconMap,
  inject,
  message,
  ref,
  storeToRefs,
  useBase,
  useI18n,
  useNuxtApp,
  useSmartsheetStoreOrThrow,
} from '#imports'

const { t } = useI18n()

const isPublicView = inject(IsPublicInj, ref(false))

const fields = inject(FieldsInj, ref([]))

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { $api } = useNuxtApp()

const meta = inject(MetaInj, ref())

const selectedView = inject(ActiveViewInj)

const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

const exportFile = async (exportType: ExportTypes) => {
  let offset = 0
  let c = 1
  const responseType = exportType === ExportTypes.EXCEL ? 'base64' : 'blob'

  const XLSX = await import('xlsx')
  const FileSaver = await import('file-saver')

  try {
    while (!isNaN(offset) && offset > -1) {
      let res
      if (isPublicView.value) {
        const { exportFile: sharedViewExportFile } = useSharedView()
        res = await sharedViewExportFile(fields.value, offset, exportType, responseType, {
          sortsArr: sorts.value,
          filtersArr: nestedFilters.value,
        })
      } else {
        res = await $api.dbViewRow.export(
          'noco',
          base.value?.id as string,
          meta.value?.id as string,
          selectedView?.value.id as string,
          exportType,
          {
            responseType,
            query: {
              fields: fields.value.map((field) => field.title),
              offset,
              sortArrJson: JSON.stringify(sorts.value),
              filterArrJson: JSON.stringify(nestedFilters.value),
            },
          } as RequestParams,
        )
      }

      const { data, headers } = res

      if (exportType === ExportTypes.EXCEL) {
        const workbook = XLSX.read(data, { type: 'base64' })

        XLSX.writeFile(workbook, `${meta.value?.title}_exported_${c++}.xlsx`)
      } else if (exportType === ExportTypes.CSV) {
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })

        FileSaver.saveAs(blob, `${meta.value?.title}_exported_${c++}.csv`)
      }

      offset = +headers['nc-export-offset']
      if (offset > -1) {
        // Downloading more files
        message.info(t('msg.info.downloadingMoreFiles'))
      } else {
        // Successfully exported all table data
        message.success(t('msg.success.tableDataExported'))
      }
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <a-menu-item>
    <div v-e="['a:download:csv']" class="nc-base-menu-item" @click="exportFile(ExportTypes.CSV)">
      <component :is="iconMap.csv" />
      <!-- Download as CSV -->
      {{ $t('activity.downloadCSV') }}
    </div>
  </a-menu-item>

  <a-menu-item>
    <div v-e="['a:download:excel']" class="nc-base-menu-item" @click="exportFile(ExportTypes.EXCEL)">
      <component :is="iconMap.excel" />
      <!-- Download as XLSX -->
      {{ $t('activity.downloadExcel') }}
    </div>
  </a-menu-item>
</template>
