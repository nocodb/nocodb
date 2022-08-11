<script lang="ts" setup>
import * as XLSX from 'xlsx'
import { ExportTypes } from 'nocodb-sdk'
import FileSaver from 'file-saver'
import { notification } from 'ant-design-vue'
import { useNuxtApp } from '#app'
import { useProject } from '#imports'
import { ActiveViewInj, MetaInj } from '~/context'
import { extractSdkResponseErrorMsg } from '~/utils'
import MdiFlashIcon from '~icons/mdi/flash-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import MdiDownloadIcon from '~icons/mdi/download-outline'
import MdiUploadIcon from '~icons/mdi/upload-outline'
import MdiHookIcon from '~icons/mdi/hook'
import MdiViewListIcon from '~icons/mdi/view-list-outline'

const sharedViewListDlg = ref(false)

const publicViewId = null

// TODO: pending for shared view

// interface Props {
//   publicViewId?: string
//   queryParams?: Record<string, any>
//   reqPayload?: Record<string, any>
// }

// const { publicViewId, queryParams, reqPayload } = defineProps<Props>()

const { project } = useProject()

const { $api } = useNuxtApp()

const meta = inject(MetaInj)

const selectedView = inject(ActiveViewInj)

const showWebhookDrawer = ref(false)

const quickImportDialog = ref(false)

const exportFile = async (exportType: ExportTypes.EXCEL | ExportTypes.CSV) => {
  let offset = 0
  let c = 1
  const responseType = exportType === ExportTypes.EXCEL ? 'base64' : 'blob'
  try {
    while (!isNaN(offset) && offset > -1) {
      let res
      if (publicViewId) {
        // TODO: pending for shared view
        // const { data, headers } = await $api.public.csvExport(publicViewId, exportType, {
        //   format: responseType,
        //   query: {
        //     fields:
        //       queryParams && queryParams.fieldsOrder && queryParams.fieldsOrder.filter((c: number) => queryParams.showFields[c]),
        //     offset,
        //     sortArrJson: JSON.stringify(
        //       reqPayload &&
        //         reqPayload.sorts &&
        //         reqPayload.sorts.map(({ fk_column_id, direction }) => ({
        //           direction,
        //           fk_column_id,
        //         })),
        //     ),
        //     filterArrJson: JSON.stringify(reqPayload && reqPayload.filters),
        //   },
        //   headers: {
        //     'xc-password': reqPayload && reqPayload.password,
        //   },
        // } as Record<string, any>)
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
        notification.info({
          message: 'Downloading more files',
        })
      } else {
        notification.success({
          message: 'Successfully exported all table data',
        })
      }
    }
  } catch (e: any) {
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
    })
  }
}
</script>

<template>
  <div>
    <a-dropdown>
      <a-button v-t="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-1 align-center">
          <MdiFlashIcon />
          <!-- More -->
          <span class="!text-sm font-weight-medium">{{ $t('general.more') }}</span>
          <MdiMenuDownIcon class="text-grey" />
        </div>
      </a-button>
      <template #overlay>
        <div class="bg-white shadow-lg">
          <div>
            <div class="nc-menu-item" @click="exportFile(ExportTypes.CSV)">
              <MdiDownloadIcon />
              <!-- Download as CSV -->
              {{ $t('activity.downloadCSV') }}
            </div>
            <div class="nc-menu-item" @click="exportFile(ExportTypes.EXCEL)">
              <MdiDownloadIcon />
              <!-- Download as XLSX -->
              {{ $t('activity.downloadExcel') }}
            </div>
            <div class="nc-menu-item" @click="quickImportDialog = true">
              <MdiUploadIcon />
              <!-- Upload CSV -->
              {{ $t('activity.uploadCSV') }}
            </div>
            <div class="nc-menu-item" @click="sharedViewListDlg = true">
              <MdiViewListIcon />
              <!-- Shared View List -->
              {{ $t('activity.listSharedView') }}
            </div>
            <div class="nc-menu-item" @click="showWebhookDrawer = true">
              <MdiHookIcon />
              <!-- todo: i18n -->
              Webhook
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
