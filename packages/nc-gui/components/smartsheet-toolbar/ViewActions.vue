<script lang="ts" setup>
import { message } from 'ant-design-vue'
import {
  ActiveViewInj,
  IsLockedInj,
  IsPublicInj,
  extractSdkResponseErrorMsg,
  inject,
  ref,
  useI18n,
  useNuxtApp,
  useProject,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  viewIcons,
} from '#imports'
import { LockType } from '~/lib'
import MdiLockOutlineIcon from '~icons/mdi/lock-outline'
import MdiAccountIcon from '~icons/mdi/account'
import MdiAccountGroupIcon from '~icons/mdi/account-group'
import AcountTreeRoundedIcon from '~icons/material-symbols/account-tree-rounded'

const { t } = useI18n()

const sharedViewListDlg = ref(false)

const isPublicView = inject(IsPublicInj, ref(false))

const isView = false

const { $api, $e } = useNuxtApp()

const selectedView = inject(ActiveViewInj)

const isLocked = inject(IsLockedInj)

const showWebhookDrawer = ref(false)

const showApiSnippetDrawer = ref(false)

const showErd = ref(false)

const quickImportDialog = ref(false)

const { isUIAllowed } = useUIPermission()

const { isSharedBase } = useProject()

const Icon = computed(() => {
  switch (selectedView?.value.lock_type) {
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
    // Coming soon
    return message.info(t('msg.toast.futureRelease'))
  }
  try {
    selectedView.value.lock_type = type
    await $api.dbView.update(selectedView.value.id as string, {
      lock_type: type,
    })

    message.success(`Successfully Switched to ${type} view`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const { isSqlView } = useSmartsheetStoreOrThrow()
</script>

<template>
  <div>
    <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
      <a-button v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-2 items-center">
          <component
            :is="viewIcons[selectedView?.type].icon"
            class="nc-view-icon group-hover:hidden"
            :style="{ color: viewIcons[selectedView?.type].color }"
          />
          <span class="!text-sm font-weight-normal"
            ><GeneralTruncateText>{{ selectedView?.title }}</GeneralTruncateText></span
          >
          <component :is="Icon" class="text-gray-500" :class="`nc-icon-${selectedView?.lock_type}`" />
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>

      <template #overlay>
        <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded">
          <a-menu-item-group>
            <a-sub-menu
              v-if="isUIAllowed('view-type')"
              key="lock-type"
              class="scrollbar-thin-dull min-w-50 max-h-90vh overflow-auto !py-0"
            >
              <template #title>
                <div v-e="['c:navdraw:preview-as']" class="nc-project-menu-item group px-0 !py-0">
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
                <!--                Download -->
                <div v-e="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                  <MdiDownload class="group-hover:text-accent text-gray-500" />
                  {{ $t('general.download') }}
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>
              <SmartsheetToolbarExportSubActions />
            </a-sub-menu>
            <template v-if="isUIAllowed('csvImport') && !isView && !isPublicView && !isSqlView">
              <a-sub-menu key="upload">
                <!--                Upload -->
                <template #title>
                  <div v-e="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                    <MdiUpload class="group-hover:text-accent text-gray-500" />
                    {{ $t('general.upload') }}
                    <div class="flex-1" />

                    <MaterialSymbolsChevronRightRounded
                      class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                    />
                  </div>
                </template>

                <template #expandIcon></template>
                <a-menu-item v-if="isUIAllowed('csvImport') && !isView && !isPublicView">
                  <div
                    v-e="['a:actions:upload-csv']"
                    class="nc-project-menu-item"
                    :class="{ disabled: isLocked }"
                    @click="!isLocked ? (quickImportDialog = true) : {}"
                  >
                    <MdiUploadOutline class="text-gray-500" />
                    <!-- Upload CSV -->
                    {{ $t('activity.uploadCSV') }}
                    <div class="flex items-center text-gray-400"><MdiAlpha />version</div>
                  </div>
                </a-menu-item>
              </a-sub-menu>
            </template>
            <a-menu-divider />
            <a-menu-item v-if="isUIAllowed('SharedViewList') && !isView && !isPublicView">
              <div v-e="['a:actions:shared-view-list']" class="py-2 flex gap-2 items-center" @click="sharedViewListDlg = true">
                <MdiViewListOutline class="text-gray-500" />
                <!-- Shared View List -->
                {{ $t('activity.listSharedView') }}
              </div>
            </a-menu-item>
            <a-menu-item v-if="!isSqlView">
              <div
                v-if="isUIAllowed('webhook') && !isView && !isPublicView"
                v-e="['c:actions:webhook']"
                class="py-2 flex gap-2 items-center"
                @click="showWebhookDrawer = true"
              >
                <MdiHook class="text-gray-500" />
                {{ $t('objects.webhooks') }}
              </div>
            </a-menu-item>
            <a-menu-item v-if="!isSharedBase && !isPublicView">
              <div v-e="['c:snippet:open']" class="py-2 flex gap-2 items-center" @click="showApiSnippetDrawer = true">
                <MdiXml class="text-gray-500" />
                <!-- Get API Snippet -->
                {{ $t('activity.getApiSnippet') }}
              </div>
            </a-menu-item>
            <a-menu-item>
              <div v-e="['c:erd:open']" class="py-2 flex gap-2 items-center nc-view-action-erd" @click="showErd = true">
                <AcountTreeRoundedIcon class="text-gray-500" />
                {{ $t('title.erdView') }}
              </div>
            </a-menu-item>
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>

    <DlgQuickImport v-if="quickImportDialog" v-model="quickImportDialog" import-type="csv" :import-only="true" />

    <WebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" />

    <SmartsheetToolbarErd v-model="showErd" />

    <a-modal
      v-model:visible="sharedViewListDlg"
      :title="$t('activity.listSharedView')"
      width="max(900px,60vw)"
      :footer="null"
      wrap-class-name="nc-modal-shared-view-list"
    >
      <SmartsheetToolbarSharedViewList v-if="sharedViewListDlg" />
    </a-modal>
    <SmartsheetApiSnippet v-model="showApiSnippetDrawer" />
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
