<script lang="ts" setup>
import * as XLSX from 'xlsx'
// todo: export types is missing EXCEL
// import { ExportTypes } from 'nocodb-sdk'
import FileSaver from 'file-saver'
import { message } from 'ant-design-vue'
import {
  ActiveViewInj,
  FieldsInj,
  IsPublicInj,
  MetaInj,
  extractSdkResponseErrorMsg,
  inject,
  ref,
  useNuxtApp,
  useProject,
  useUIPermission,
} from '#imports'

enum ExportTypes {
  EXCEL = 'excel',
  CSV = 'csv',
}

const sharedViewListDlg = ref(false)

const isPublicView = inject(IsPublicInj, ref(false))

const isView = false

// TODO: pending for shared view

const { project } = useProject()

const { $api } = useNuxtApp()

const meta = inject(MetaInj)
const fields = inject(FieldsInj, ref([]))
const selectedView = inject(ActiveViewInj)

const showWebhookDrawer = ref(false)

const quickImportDialog = ref(false)

const { isUIAllowed } = useUIPermission()

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
              offset,
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
  <div>
    <a-dropdown>
      <a-button v-t="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-1 align-center">
          <MdiFlashOutline />

          <!-- More -->
          <span class="!text-sm font-weight-medium">{{ $t('general.more') }}</span>

          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>

      <template #overlay>
        <div class="bg-white shadow-lg !border">
          <div>
            <div v-t="['a:actions:download-csv']" class="nc-menu-item" @click="exportFile(ExportTypes.CSV)">
              <MdiDownloadOutline />
              <!-- Download as CSV -->
              {{ $t('activity.downloadCSV') }}
            </div>

            <div v-t="['a:actions:download-excel']" class="nc-menu-item" @click="exportFile(ExportTypes.EXCEL)">
              <MdiDownloadOutline />
              <!-- Download as XLSX -->
              {{ $t('activity.downloadExcel') }}
            </div>

            <div
              v-if="isUIAllowed('csvImport') && !isView && !isPublicView"
              v-t="['a:actions:upload-csv']"
              class="nc-menu-item"
              @click="quickImportDialog = true"
            >
              <MdiUploadOutline />
              <!-- Upload CSV -->
              {{ $t('activity.uploadCSV') }}
            </div>

            <div
              v-if="isUIAllowed('SharedViewList') && !isView && !isPublicView"
              v-t="['a:actions:shared-view-list']"
              class="nc-menu-item"
              @click="sharedViewListDlg = true"
            >
              <MdiViewListOutline />
              <!-- Shared View List -->
              {{ $t('activity.listSharedView') }}
            </div>

            <div
              v-if="isUIAllowed('webhook') && !isView && !isPublicView"
              v-t="['c:actions:webhook']"
              class="nc-menu-item"
              @click="showWebhookDrawer = true"
            >
              <MdiHook />
              {{ $t('objects.webhooks') }}
            </div>
          </div>
        </div>
      </template>
    </a-dropdown>

    <DlgQuickImport v-if="quickImportDialog" v-model="quickImportDialog" import-type="csv" :import-only="true" />

    <WebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" />

    <a-modal v-model:visible="sharedViewListDlg" title="Shared view list" width="max(900px,60vw)" :footer="null">
      <SmartsheetToolbarSharedViewList v-if="sharedViewListDlg" />
    </a-modal>
  </div>
</template>
