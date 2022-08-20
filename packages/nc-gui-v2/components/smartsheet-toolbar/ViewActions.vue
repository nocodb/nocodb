<script lang="ts" setup>
import * as XLSX from 'xlsx'
import { ExportTypes } from 'nocodb-sdk'
import FileSaver from 'file-saver'
import { message } from 'ant-design-vue'
import { LockType } from '~/lib'
import { viewIcons } from '~/utils'
import {
  ActiveViewInj,
  FieldsInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  extractSdkResponseErrorMsg,
  inject,
  ref,
  useNuxtApp,
  useProject,
  useUIPermission,
} from '#imports'
import MdiLockOutlineIcon from '~icons/mdi/lock-outline'
import MdiAccountIcon from '~icons/mdi/account'
import MdiAccountGroupIcon from '~icons/mdi/account-group'

const sharedViewListDlg = ref(false)

const isPublicView = inject(IsPublicInj, ref(false))

const isView = false

const { project } = useProject()

const { $api, $e } = useNuxtApp()

const meta = inject(MetaInj)

const fields = inject(FieldsInj, ref([]))

const selectedView = inject(ActiveViewInj)

const isLocked = inject(IsLockedInj)

const showWebhookDrawer = ref(false)

const quickImportDialog = ref(false)

const showApiSnippet = ref(false)

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

const Icon = computed(() => {
  switch ((selectedView?.value as any)?.lock_type) {
    case LockType.Personal:
      return MdiAccountIcon
    case LockType.Locked:
      return MdiLockOutlineIcon
    case LockType.Collaborative:
    default:
      return MdiAccountGroupIcon
  }
})

async function changeLockType(type: LockType) {
  $e('a:grid:lockmenu', { lockType: type })

  if (!selectedView?.value) return

  if (type === 'personal') {
    return message.info('Coming soon')
  }
  try {
    ;(selectedView.value as any).lock_type = type
    $api.dbView.update(selectedView.value.id as string, {
      lock_type: type,
    })

    message.success(`Successfully Switched to ${type} view`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div>
    <a-dropdown :trigger="['click']">
      <a-button v-t="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-2 items-center">
          <component
            :is="viewIcons[selectedView?.type].icon"
            class="nc-view-icon group-hover:hidden"
            :style="{ color: viewIcons[selectedView?.type].color }"
          />
          <span class="!text-sm font-weight-normal">{{ selectedView?.title }}</span>
          <component :is="Icon" class="text-gray-500" />
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>

      <template #overlay>
        <a-menu class="ml-6 !text-sm !p-0 !rounded">
          <a-menu-item-group>
            <a-sub-menu
              v-if="isUIAllowed('view-type')"
              key="lock-type"
              class="scrollbar-thin-dull min-w-50 max-h-90vh overflow-auto !py-0"
            >
              <template #title>
                <div v-t="['c:navdraw:preview-as']" class="nc-project-menu-item group px-0">
                  <SmartsheetToolbarLockType hide-tick :type="selectedView?.lock_type || LockType.Collaborative" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>
              <a-menu-item @click="changeLockType(LockType.Collaborative)">
                <SmartsheetToolbarLockType :type="LockType.Collaborative" />
              </a-menu-item>
              <a-menu-item @click="changeLockType(LockType.Locked)">
                <SmartsheetToolbarLockType :type="LockType.Locked" />
              </a-menu-item>
              <a-menu-item @click="changeLockType(LockType.Personal)">
                <SmartsheetToolbarLockType :type="LockType.Personal" />
              </a-menu-item>
            </a-sub-menu>
            <a-menu-divider />
            <a-sub-menu key="download">
              <template #title>
                <div v-t="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                  <MdiDownload class="group-hover:text-accent" />
                  Download
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>
              <a-menu-item>
                <div v-t="['a:actions:download-csv']" class="nc-menu-item" @click="exportFile(ExportTypes.CSV)">
                  <MdiDownloadOutline class="text-gray-500" />
                  <!-- Download as CSV -->
                  {{ $t('activity.downloadCSV') }}
                </div>
              </a-menu-item>
              <a-menu-item>
                <div v-t="['a:actions:download-excel']" class="nc-menu-item" @click="exportFile(ExportTypes.EXCEL)">
                  <MdiDownloadOutline class="text-gray-500" />
                  <!-- Download as XLSX -->
                  {{ $t('activity.downloadExcel') }}
                </div>
              </a-menu-item>
            </a-sub-menu>
            <a-menu-divider />
            <a-sub-menu key="upload">
              <template #title>
                <div v-t="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                  <MdiUpload class="group-hover:text-accent" />
                  Upload
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>
              <a-menu-item>
                <div
                  v-if="isUIAllowed('csvImport') && !isView && !isPublicView"
                  v-t="['a:actions:upload-csv']"
                  class="nc-menu-item"
                  :class="{ disabled: isLocked }"
                  @click="!isLocked ? (quickImportDialog = true) : {}"
                >
                  <MdiUploadOutline class="text-gray-500" />
                  <!-- Upload CSV -->
                  {{ $t('activity.uploadCSV') }}
                </div>
              </a-menu-item>
            </a-sub-menu>

            <a-menu-divider />
            <a-menu-item>
              <div
                v-if="isUIAllowed('SharedViewList') && !isView && !isPublicView"
                v-t="['a:actions:shared-view-list']"
                class="py-2 flex gap-2"
                @click="sharedViewListDlg = true"
              >
                <MdiViewListOutline class="text-gray-500" />
                <!-- Shared View List -->
                {{ $t('activity.listSharedView') }}
              </div>
            </a-menu-item>
            <a-menu-item>
              <div
                v-if="isUIAllowed('webhook') && !isView && !isPublicView"
                v-t="['c:actions:webhook']"
                class="py-2 flex gap-2"
                @click="showWebhookDrawer = true"
              >
                <MdiHook class="text-gray-500" />
                {{ $t('objects.webhooks') }}
              </div>
            </a-menu-item>
            <a-menu-item>
              <div
                v-if="isUIAllowed('webhook') && !isView && !isPublicView"
                v-t="['c:actions:webhook']"
                class="py-2 flex gap-2"
                @click="showWebhookDrawer = true"
              >
                <MdiHook class="text-gray-500" />
                <mdi-hook />{{ $t('objects.webhooks') }}
              </div>
            </a-menu-item>
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>

    <DlgQuickImport v-if="quickImportDialog" v-model="quickImportDialog" import-type="csv" :import-only="true" />

    <WebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" />

    <a-modal v-model:visible="sharedViewListDlg" title="Shared view list" width="max(900px,60vw)" :footer="null">
      <SmartsheetToolbarSharedViewList v-if="sharedViewListDlg" />
    </a-modal>
  </div>
</template>

<style scoped>
:deep(.ant-dropdown-menu-submenu-title) {
  @apply py-0;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply hidden;
}
</style>
