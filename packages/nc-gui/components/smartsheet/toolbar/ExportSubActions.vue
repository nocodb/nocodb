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

const isExportingType = ref<ExportTypes | undefined>(undefined)

const exportFile = async (exportType: ExportTypes) => {
  let offset = 0
  let c = 1
  const responseType = exportType === ExportTypes.EXCEL ? 'base64' : 'blob'

  isExportingType.value = exportType

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

      setTimeout(() => {
        isExportingType.value = undefined
      }, 200)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="flex py-3 px-4 font-bold uppercase text-xs text-gray-500">Download Data</div>

  <NcMenuItem @click="exportFile(ExportTypes.CSV)">
    <div class="flex flex-row items-center justify-between">
      <div v-e="['a:download:csv']" class="nc-base-menu-item !py-0">
        <GeneralLoader v-if="isExportingType === ExportTypes.CSV" class="!max-h-4.5 !-mt-1 !mr-0.75" />
        <component :is="iconMap.csv" v-else />
        <!-- Download as CSV -->
        {{ $t('activity.downloadCSV') }}
      </div>
    </div>
  </NcMenuItem>

  <NcMenuItem @click="exportFile(ExportTypes.EXCEL)">
    <div class="flex flex-row items-center justify-between">
      <div v-e="['a:download:excel']" class="nc-base-menu-item !py-0">
        <GeneralLoader v-if="isExportingType === ExportTypes.EXCEL" class="!max-h-4.5 !-mt-1 !mr-0.75" />
        <component :is="iconMap.excel" v-else />

        <!-- Download as XLSX -->
        {{ $t('activity.downloadExcel') }}
      </div>
    </div>
  </NcMenuItem>
</template>
