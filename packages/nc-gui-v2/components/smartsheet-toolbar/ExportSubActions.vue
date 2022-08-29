<script setup lang="ts">
import { ExportTypes } from 'nocodb-sdk'
import FileSaver from 'file-saver'
import * as XLSX from 'xlsx'
import { message } from 'ant-design-vue'

const isPublicView = inject(IsPublicInj, ref(false))

const fields = inject(FieldsInj, ref([]))

const { project } = useProject()

const { $api } = useNuxtApp()

const meta = inject(MetaInj)

const selectedView = inject(ActiveViewInj)

const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

const exportFile = async (exportType: ExportTypes) => {
  let offset = 0
  let c = 1
  const responseType = exportType === ExportTypes.EXCEL ? 'base64' : 'blob'

  try {
    while (!isNaN(offset) && offset > -1) {
      let res
      if (isPublicView.value) {
        const { exportFile: sharedViewExportFile } = useSharedView()
        res = await sharedViewExportFile(fields.value, offset, exportType, responseType)
      } else {
        res = await $api.dbViewRow.export(
          'noco',
          project?.value.title as string,
          meta?.value.title as string,
          selectedView?.value.title as string,
          exportType,
          {
            responseType,
            query: {
              fields: fields.value.map((field) => field.title),
              offset,
              sortArrJson: JSON.stringify(sorts.value),
              filterArrJson: JSON.stringify(nestedFilters.value),
            },
          } as any,
        )
      }
      const { data, headers } = res
      if (exportType === ExportTypes.EXCEL) {
        const workbook = XLSX.read(data, { type: 'base64' })
        XLSX.writeFile(workbook, `${meta?.value.title}_exported_${c++}.xlsx`)
      } else if (exportType === ExportTypes.CSV) {
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })
        FileSaver.saveAs(blob, `${meta?.value.title}_exported_${c++}.csv`)
      }
      offset = +headers['nc-export-offset']
      if (offset > -1) {
        message.info('Downloading more files')
      } else {
        message.success('Successfully exported all table data')
      }
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <a-menu-item>
    <div v-t="['a:actions:download-csv']" class="nc-project-menu-item" @click="exportFile(ExportTypes.CSV)">
      <MdiDownloadOutline class="text-gray-500" />
      <!-- Download as CSV -->
      {{ $t('activity.downloadCSV') }}
    </div>
  </a-menu-item>
  <a-menu-item>
    <div v-t="['a:actions:download-excel']" class="nc-project-menu-item" @click="exportFile(ExportTypes.EXCEL)">
      <MdiDownloadOutline class="text-gray-500" />
      <!-- Download as XLSX -->
      {{ $t('activity.downloadExcel') }}
    </div>
  </a-menu-item>
</template>
