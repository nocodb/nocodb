<script lang="ts" setup>
import type { Ref } from '@vue/reactivity'
import UploadIcon from '~icons/nc-icons/upload'
import DownloadIcon from '~icons/nc-icons/download'
import {
  ActiveViewInj,
  IsLockedInj,
  IsPublicInj,
  LockType,
  MetaInj,
  extractSdkResponseErrorMsg,
  iconMap,
  inject,
  message,
  ref,
  useBase,
  useI18n,
  useMenuCloseOnEsc,
  useNuxtApp,
  useRoles,
  useSmartsheetStoreOrThrow,
} from '#imports'

const { t } = useI18n()

const sharedViewListDlg = ref(false)

const isPublicView = inject(IsPublicInj, ref(false))

const isView = false

const { $api, $e } = useNuxtApp()

const { isSqlView } = useSmartsheetStoreOrThrow()

const selectedView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const showWebhookDrawer = ref(false)

const showApiSnippetDrawer = ref(false)

const showErd = ref(false)

type QuickImportDialogType = 'csv' | 'excel' | 'json'

// TODO: add 'json' when it's ready
const quickImportDialogTypes: QuickImportDialogType[] = ['csv', 'excel']

const quickImportDialogs: Record<(typeof quickImportDialogTypes)[number], Ref<boolean>> = quickImportDialogTypes.reduce(
  (acc: any, curr) => {
    acc[curr] = ref(false)
    return acc
  },
  {},
) as Record<QuickImportDialogType, Ref<boolean>>

const { isUIAllowed } = useRoles()

useBase()

const meta = inject(MetaInj, ref())

const currentBaseId = computed(() => meta.value?.source_id)

/*
const Icon = computed(() => {
  switch (selectedView.value?.lock_type) {
    case LockType.Personal:
      return iconMap.account
    case LockType.Locked:
      return iconMap.lock
    case LockType.Collaborative:
    default:
      return iconMap.users
  }
})
*/

const lockType = computed(() => (selectedView.value?.lock_type as LockType) || LockType.Collaborative)

async function changeLockType(type: LockType) {
  $e('a:grid:lockmenu', { lockType: type })

  if (!selectedView.value) return

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

const open = ref(false)

useMenuCloseOnEsc(open)
</script>

<template>
  <div>
    <a-dropdown v-model:visible="open" :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu" placement="bottomRight">
      <a-button v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn !border-1 !border-gray-200 !rounded-md !py-1 !px-2">
        <MdiDotsHorizontal class="!w-4 !h-4" />
      </a-button>

      <template #overlay>
        <a-menu class="!py-0 !rounded !text-gray-800 text-sm" data-testid="toolbar-actions" @click="open = false">
          <a-menu-item-group>
            <template v-if="isUIAllowed('csvTableImport') && !isView && !isPublicView && !isSqlView">
              <a-sub-menu key="upload">
                <template #title>
                  <div v-e="['c:navdraw:preview-as']" class="nc-base-menu-item group">
                    <UploadIcon class="w-4 h-4" />
                    {{ $t('general.upload') }}
                    <div class="flex-1" />

                    <component :is="iconMap.arrowRight" />
                  </div>
                </template>

                <template #expandIcon></template>
                <template v-for="(dialog, type) in quickImportDialogs">
                  <a-menu-item v-if="isUIAllowed(`${type}TableImport`) && !isView && !isPublicView" :key="type">
                    <div
                      v-e="[`a:upload:${type}`]"
                      class="nc-base-menu-item"
                      :class="{ disabled: isLocked }"
                      @click="!isLocked ? (dialog.value = true) : {}"
                    >
                      <component :is="iconMap.upload" />
                      {{ `${$t('general.upload')} ${type.toUpperCase()}` }}
                    </div>
                  </a-menu-item>
                </template>
              </a-sub-menu>
            </template>
            <a-sub-menu key="download">
              <template #title>
                <div v-e="['c:download']" class="nc-base-menu-item group">
                  <DownloadIcon class="w-4 h-4" />
                  {{ $t('general.download') }}
                  <div class="flex-1" />

                  <component :is="iconMap.arrowRight" />
                </div>
              </template>

              <template #expandIcon></template>

              <LazySmartsheetToolbarExportSubActions />
            </a-sub-menu>

            <a-sub-menu
              v-if="isUIAllowed('viewCreateOrEdit')"
              key="lock-type"
              class="scrollbar-thin-dull max-h-90vh overflow-auto !py-0"
            >
              <template #title>
                <div v-e="['c:navdraw:preview-as']" class="nc-base-menu-item group px-0 !py-0">
                  <LazySmartsheetToolbarLockType hide-tick :type="lockType" />

                  <component :is="iconMap.arrowRight" />
                </div>
              </template>

              <template #expandIcon></template>
              <a-menu-item @click="changeLockType(LockType.Collaborative)">
                <LazySmartsheetToolbarLockType :type="LockType.Collaborative" />
              </a-menu-item>

              <a-menu-item @click="changeLockType(LockType.Locked)">
                <LazySmartsheetToolbarLockType :type="LockType.Locked" />
              </a-menu-item>

              <!--    <a-menu-item @click="changeLockType(LockType.Personal)">
                <LazySmartsheetToolbarLockType :type="LockType.Personal" />
              </a-menu-item> -->
            </a-sub-menu>
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>

    <template v-if="currentBaseId">
      <LazyDlgQuickImport
        v-for="tp in quickImportDialogTypes"
        :key="tp"
        v-model="quickImportDialogs[tp].value"
        :import-type="tp"
        :source-id="currentBaseId"
        :import-data-only="true"
      />
    </template>

    <LazyWebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" />

    <LazySmartsheetToolbarErd v-model="showErd" />

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

    <LazySmartsheetApiSnippet v-model="showApiSnippetDrawer" />
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
