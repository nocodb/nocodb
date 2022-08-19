<script lang="ts" setup>
import * as XLSX from 'xlsx'
import { ExportTypes } from 'nocodb-sdk'
import FileSaver from 'file-saver'
import { message } from 'ant-design-vue'
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

enum LockType {
  Personal = 'personal',
  Locked = 'locked',
  Collaborative = 'collaborative',
}

const sharedViewListDlg = ref(false)

const isPublicView = inject(IsPublicInj, ref(false))

const isView = false

const { project } = useProject()

const { $api } = useNuxtApp()

const meta = inject(MetaInj)

const fields = inject(FieldsInj, ref([]))

const selectedView = inject(ActiveViewInj)

const isLocked = inject(IsLockedInj)

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

  if (type === 'personal') {
    return message.info('Coming soon')
  }
  try {
    ;(view.value as any).lock_type = type
    $api.dbView.update(view.value.id as string, {
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
    <a-dropdown>
      <a-button v-t="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-2 align-center">
          <component
            :is="viewIcons[selectedView?.type].icon"
            class="nc-view-icon group-hover:hidden"
            :class="`text-${viewIcons[selectedView?.type].color}`"
          />
          <span class="!text-sm font-weight-medium">{{ selectedView?.title }}</span>
          <component :is="Icon" />
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>

      <template #overlay>
        <a-menu class="ml-6 !text-sm !p-0 !rounded">
          <a-menu-item-group>
            <a-sub-menu key="lock-type" v-if="isUIAllowed('view-type')" >
              <template #title>
                <div v-t="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                  <MdiFileEyeOutline class="group-hover:text-pink-500" />
                  Lock Type
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>
              <a-menu-item>
                <!--              <div class="min-w-[350px] max-w-[500px] shadow bg-white"> -->
                <!--                <div> -->
                <div class="nc-menu-item" @click="changeLockType(LockType.Collaborative)">
                  <div>
                    <MdiCheck v-if="!view?.lock_type || view?.lock_type === LockType.Collaborative" />
                    <span v-else />
                    <div>
                      <MdiAccountGroupIcon />
                      Collaborative view
                      <div class="nc-subtitle">
                        Collaborators with edit permissions or higher can change the view configuration.
                      </div>
                    </div>
                  </div>
                </div>
              </a-menu-item>
              <a-menu-item>
                <div class="nc-menu-item" @click="changeLockType(LockType.Locked)">
                  <div>
                    <MdiCheck v-if="selectedView?.lock_type === LockType.Locked" />
                    <span v-else />
                    <div>
                      <MdiLockOutlineIcon />
                      Locked View
                      <div class="nc-subtitle">No one can edit the view configuration until it is unlocked.</div>
                    </div>
                  </div>
                </div>
              </a-menu-item>
              <a-menu-item>
                <div class="nc-menu-item" @click="changeLockType(LockType.Personal)">
                  <div>
                    <MdiCheck v-if="selectedView?.lock_type === LockType.Personal" />
                    <span v-else />
                    <div>
                      <MdiAccountIcon />
                      Personal view
                      <div class="nc-subtitle">
                        Only you can edit the view configuration. Other collaborators’ personal views are hidden by
                        default.
                      </div>
                    </div>
                  </div>
                </div>
                <!--                </div> -->
                <!--              </div> -->
              </a-menu-item>
            </a-sub-menu>
            <a-sub-menu key="download">
              <template #title>
                <div v-t="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                  <MdiDownload class="group-hover:text-pink-500" />
                  Download
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
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
            <a-sub-menu key="upload">
              <template #title>
                <div v-t="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                  <MdiDownload class="group-hover:text-pink-500" />
                  Download
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
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

            <!--            <div class="bg-gray-50 py-2 shadow-lg !border"> -->
            <!--              <div> -->
            <!--                <div v-t="['a:actions:download-csv']" class="nc-menu-item" @click="exportFile(ExportTypes.CSV)"> -->
            <!--                  <MdiDownloadOutline class="text-gray-500" /> -->
            <!--                  &lt;!&ndash; Download as CSV &ndash;&gt; -->
            <!--                  {{ $t('activity.downloadCSV') }} -->
            <!--                </div> -->

            <!--                <div v-t="['a:actions:download-excel']" class="nc-menu-item" @click="exportFile(ExportTypes.EXCEL)"> -->
            <!--                  <MdiDownloadOutline class="text-gray-500" /> -->
            <!--                  &lt;!&ndash; Download as XLSX &ndash;&gt; -->
            <!--                  {{ $t('activity.downloadExcel') }} -->
            <!--                </div> -->

            <!--                <div -->
            <!--                  v-if="isUIAllowed('csvImport') && !isView && !isPublicView" -->
            <!--                  v-t="['a:actions:upload-csv']" -->
            <!--                  class="nc-menu-item" -->
            <!--                  :class="{ disabled: isLocked }" -->
            <!--                  @click="!isLocked ? (quickImportDialog = true) : {}" -->
            <!--                > -->
            <!--                  <MdiUploadOutline class="text-gray-500" /> -->
            <!--                  &lt;!&ndash; Upload CSV &ndash;&gt; -->
            <!--                  {{ $t('activity.uploadCSV') }} -->
            <!--                </div> -->

            <!--                <div -->
            <!--                  v-if="isUIAllowed('SharedViewList') && !isView && !isPublicView" -->
            <!--                  v-t="['a:actions:shared-view-list']" -->
            <!--                  class="nc-menu-item" -->
            <!--                  @click="sharedViewListDlg = true" -->
            <!--                > -->
            <!--                  <MdiViewListOutline class="text-gray-500" /> -->
            <!--                  &lt;!&ndash; Shared View List &ndash;&gt; -->
            <!--                  {{ $t('activity.listSharedView') }} -->
            <!--                </div> -->

            <!--                <div -->
            <!--                  v-if="isUIAllowed('webhook') && !isView && !isPublicView" -->
            <!--                  v-t="['c:actions:webhook']" -->
            <!--                  class="nc-menu-item" -->
            <!--                  @click="showWebhookDrawer = true" -->
            <!--                > -->
            <!--                  <MdiHook class="text-gray-500" /> -->
            <!--                  {{ $t('objects.webhooks') }} -->
            <!--                </div> -->
            <!--              </div> -->
            <!--            </div> -->


            <a-menu-item>
              <div
                v-if="isUIAllowed('SharedViewList') && !isView && !isPublicView"
                v-t="['a:actions:shared-view-list']"
                @click="sharedViewListDlg = true"
                class="py-2 flex gap-2"
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
