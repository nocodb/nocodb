<script setup lang="ts">
import type { RequestParams } from 'nocodb-sdk'
import { ExportTypes } from 'nocodb-sdk'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

const isPublicView = inject(IsPublicInj, ref(false))

const fields = inject(FieldsInj, ref([]))

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { $api } = useNuxtApp()

const meta = inject(MetaInj, ref())

const selectedView = inject(ActiveViewInj)

const { activeNestedFilters: nestedFilters, activeSorts: sorts } = storeToRefs(useViewsStore())

const isExportingType = ref<ExportTypes | undefined>(undefined)

const exportFile = async (exportType: ExportTypes) => {
  let offset = 0
  let c = 1
  const responseType = exportType === ExportTypes.EXCEL ? 'base64' : 'blob'

  isExportingType.value = exportType

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

        saveAs(blob, `${meta.value?.title}_exported_${c++}.csv`)
      }

      offset = +headers['nc-export-offset']

      setTimeout(() => {
        isExportingType.value = undefined
      }, 200)
    }
  } catch (e: any) {
    isExportingType.value = undefined
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <NcMenuItemLabel>
    {{ $t('labels.downloadData') }}
  </NcMenuItemLabel>

  <NcMenuItem v-e="['a:download:csv']" @click.stop="exportFile(ExportTypes.CSV)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="isExportingType === ExportTypes.CSV" size="regular" />
      <component :is="iconMap.ncFileTypeCsvSmall" v-else class="w-4" />
      <!-- Download as CSV -->
      CSV
    </div>
  </NcMenuItem>

  <NcMenuItem v-e="['a:download:excel']" @click.stop="exportFile(ExportTypes.EXCEL)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="isExportingType === ExportTypes.EXCEL" size="regular" />
      <component :is="iconMap.ncFileTypeExcel" v-else class="w-4" />

      <!-- Download as XLSX -->
      Excel
    </div>
  </NcMenuItem>
</template>
