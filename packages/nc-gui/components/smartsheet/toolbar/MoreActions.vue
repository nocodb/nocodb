<script lang="ts" setup>
import type { RequestParams } from 'nocodb-sdk'
import { ExportTypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  ref,
  storeToRefs,
  useBase,
  useI18n,
  useNuxtApp,
  useRoles,
  useSharedView,
  useSmartsheetStoreOrThrow,
} from '#imports'

const { t } = useI18n()

const sharedViewListDlg = ref(false)

const isPublicView = inject(IsPublicInj, ref(false))

const isView = false

const { base } = storeToRefs(useBase())

const { $api } = useNuxtApp()

const meta = inject(MetaInj, ref())

const fields = inject(FieldsInj, ref([]))

const selectedView = inject(ActiveViewInj, ref())

const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

const { exportFile: sharedViewExportFile } = useSharedView()

const isLocked = inject(IsLockedInj)

const showWebhookDrawer = ref(false)

const quickImportDialog = ref(false)

const { isUIAllowed } = useRoles()

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
        res = await sharedViewExportFile(fields.value, offset, exportType, responseType)
      } else {
        res = await $api.dbViewRow.export(
          'noco',
          base?.value.id as string,
          meta.value?.id as string,
          selectedView.value?.id as string,
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
  <div>
    <a-dropdown>
      <a-button v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-1 items-center">
          <MdiFlashOutline />

          <!-- More -->
          <span class="!text-sm font-weight-medium">{{ $t('general.more') }}</span>

          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>

      <template #overlay>
        <div class="bg-gray-50 py-2 shadow-lg !border">
          <div>
            <div v-e="['a:actions:download-csv']" class="nc-menu-item" @click="exportFile(ExportTypes.CSV)">
              <MdiDownloadOutline class="text-gray-500" />
              <!-- Download as CSV -->
              {{ $t('activity.downloadCSV') }}
            </div>

            <div v-e="['a:actions:download-excel']" class="nc-menu-item" @click="exportFile(ExportTypes.EXCEL)">
              <MdiDownloadOutline class="text-gray-500" />
              <!-- Download as XLSX -->
              {{ $t('activity.downloadExcel') }}
            </div>

            <div
              v-if="isUIAllowed('csvImport') && !isView && !isPublicView"
              v-e="['a:actions:upload-csv']"
              class="nc-menu-item"
              :class="{ disabled: isLocked }"
              @click="!isLocked ? (quickImportDialog = true) : {}"
            >
              <MdiUploadOutline class="text-gray-500" />
              <!-- Upload CSV -->
              {{ $t('activity.uploadCSV') }}
            </div>

            <div
              v-if="isUIAllowed('viewShare') && !isView && !isPublicView"
              v-e="['a:actions:shared-view-list']"
              class="nc-menu-item"
              @click="sharedViewListDlg = true"
            >
              <MdiViewListOutline class="text-gray-500" />
              <!-- Shared View List -->
              {{ $t('activity.listSharedView') }}
            </div>
            <div
              v-if="isUIAllowed('webhook') && !isView && !isPublicView"
              v-e="['c:actions:webhook']"
              class="nc-menu-item"
              @click="showWebhookDrawer = true"
            >
              <MdiHook class="text-gray-500" />
              {{ $t('objects.webhooks') }}
            </div>
          </div>
        </div>
      </template>
    </a-dropdown>

    <LazyDlgQuickImport v-if="quickImportDialog" v-model="quickImportDialog" import-type="csv" :import-data-only="true" />

    <LazyWebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" />

    <a-modal
      v-model:visible="sharedViewListDlg"
      :class="{ active: sharedViewListDlg }"
      :title="$t('activity.listSharedView')"
      width="max(900px,60vw)"
      :footer="null"
      wrap-class-name="nc-modal-shared-view-list"
    >
      <LazySmartsheetToolbarSharedViewList v-if="sharedViewListDlg" />
    </a-modal>
  </div>
</template>
