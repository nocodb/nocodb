<script lang="ts" setup>
import type { Ref } from '@vue/reactivity'
import {
  ActiveViewInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  extractSdkResponseErrorMsg,
  iconMap,
  inject,
  message,
  ref,
  storeToRefs,
  useI18n,
  useMenuCloseOnEsc,
  useNuxtApp,
  useProject,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'
import { LockType } from '~/lib'

const { t } = useI18n()

const sharedViewListDlg = ref(false)

const { isMobileMode } = useGlobal()

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

const quickImportDialogs: Record<typeof quickImportDialogTypes[number], Ref<boolean>> = quickImportDialogTypes.reduce(
  (acc: any, curr) => {
    acc[curr] = ref(false)
    return acc
  },
  {},
) as Record<QuickImportDialogType, Ref<boolean>>

const { isUIAllowed } = useUIPermission()

const { isSharedBase } = storeToRefs(useProject())

const meta = inject(MetaInj, ref())

const currentBaseId = computed(() => meta.value?.base_id)

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

const lockType = $computed(() => (selectedView.value?.lock_type as LockType) || LockType.Collaborative)

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
    <a-dropdown v-model:visible="open" :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
      <a-button v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-2 items-center">
          <GeneralViewIcon :meta="selectedView"></GeneralViewIcon>

          <span class="!text-xs font-weight-normal">
            <GeneralTruncateText :key="selectedView?.title">{{ selectedView?.title }}</GeneralTruncateText>
          </span>

          <component :is="Icon" class="text-gray-500" :class="`nc-icon-${selectedView?.lock_type}`" />

          <component :is="iconMap.arrowDown" class="text-grey !text-0.5rem" />
        </div>
      </a-button>

      <template #overlay>
        <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded" data-testid="toolbar-actions" @click="open = false">
          <a-menu-item-group>
            <a-sub-menu
              v-if="isUIAllowed('view-type')"
              key="lock-type"
              class="scrollbar-thin-dull min-w-50 max-h-90vh overflow-auto !py-0"
            >
              <template #title>
                <div v-e="['c:navdraw:preview-as']" class="nc-project-menu-item group px-0 !py-0">
                  <LazySmartsheetToolbarLockType hide-tick :type="lockType" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>
              <a-menu-item @click="changeLockType(LockType.Collaborative)">
                <LazySmartsheetToolbarLockType :type="LockType.Collaborative" />
              </a-menu-item>

              <a-menu-item @click="changeLockType(LockType.Locked)">
                <LazySmartsheetToolbarLockType :type="LockType.Locked" />
              </a-menu-item>

              <a-menu-item @click="changeLockType(LockType.Personal)">
                <LazySmartsheetToolbarLockType :type="LockType.Personal" />
              </a-menu-item>
            </a-sub-menu>

            <a-menu-divider />

            <a-sub-menu key="download">
              <template #title>
                <!--                Download -->
                <div v-e="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                  <component :is="iconMap.download" class="group-hover:text-accent text-gray-500" />
                  {{ $t('general.download') }}
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>

              <LazySmartsheetToolbarExportSubActions />
            </a-sub-menu>

            <template v-if="isUIAllowed('csvImport') && !isView && !isPublicView && !isSqlView">
              <a-sub-menu key="upload">
                <!--                Upload -->
                <template #title>
                  <div v-e="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                    <component :is="iconMap.upload" class="group-hover:text-accent text-gray-500" />
                    {{ $t('general.upload') }}
                    <div class="flex-1" />

                    <MaterialSymbolsChevronRightRounded
                      class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                    />
                  </div>
                </template>

                <template #expandIcon></template>
                <template v-for="(dialog, type) in quickImportDialogs">
                  <a-menu-item v-if="isUIAllowed(`${type}Import`) && !isView && !isPublicView" :key="type">
                    <div
                      v-e="[`a:actions:upload-${type}`]"
                      class="nc-project-menu-item"
                      :class="{ disabled: isLocked }"
                      @click="!isLocked ? (dialog.value = true) : {}"
                    >
                      <component :is="iconMap.upload" class="text-gray-500" />
                      {{ `${$t('general.upload')} ${type.toUpperCase()}` }}
                      <div class="flex items-center text-gray-400"><MdiAlpha />version</div>
                    </div>
                  </a-menu-item>
                </template>
              </a-sub-menu>
            </template>

            <a-menu-divider />

            <a-menu-item v-if="isUIAllowed('SharedViewList') && !isView && !isPublicView">
              <div v-e="['a:actions:shared-view-list']" class="py-2 flex gap-2 items-center" @click="sharedViewListDlg = true">
                <PhListBulletsThin class="text-gray-500" />
                <!-- Shared View List -->
                {{ $t('activity.listSharedView') }}
              </div>
            </a-menu-item>

            <a-menu-item v-if="!isSqlView && !isMobileMode">
              <div
                v-if="isUIAllowed('webhook') && !isView && !isPublicView"
                v-e="['c:actions:webhook']"
                class="py-2 flex gap-2 items-center"
                @click="showWebhookDrawer = true"
              >
                <component :is="iconMap.hook" class="text-gray-500" />
                {{ $t('objects.webhooks') }}
              </div>
            </a-menu-item>

            <a-menu-item v-if="!isSharedBase && !isPublicView && !isMobileMode">
              <div v-e="['c:snippet:open']" class="py-2 flex gap-2 items-center" @click="showApiSnippetDrawer = true">
                <PhBracketsAngleThin class="text-gray-500" />
                <!-- Get API Snippet -->
                {{ $t('activity.getApiSnippet') }}
              </div>
            </a-menu-item>

            <a-menu-item>
              <div
                v-if="!isMobileMode"
                v-e="['c:erd:open']"
                class="py-2 flex gap-2 items-center nc-view-action-erd"
                @click="showErd = true"
              >
                <component :is="iconMap.erd" class="text-gray-500" />
                {{ $t('title.erdView') }}
              </div>
            </a-menu-item>
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>

    <LazyDlgQuickImport
      v-for="type in quickImportDialogTypes"
      :key="type"
      v-model="quickImportDialogs[type].value"
      :import-type="type"
      :base-id="currentBaseId"
      :import-data-only="true"
    />

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
