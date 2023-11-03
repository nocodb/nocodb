<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { LockType } from '~/lib'
import UploadIcon from '~icons/nc-icons/upload'
import DownloadIcon from '~icons/nc-icons/download'

const { activeView, views } = storeToRefs(useViewsStore())
const { loadViews, navigateToView } = useViewsStore()

const { isMobileMode } = useGlobal()

const { activeTable } = storeToRefs(useTablesStore())

const { base, isSharedBase } = storeToRefs(useBase())

const { refreshCommandPalette } = useCommandPalette()

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const isDropdownOpen = ref(false)

const currentBaseId = computed(() => activeTable.value?.source_id)

const isPublicView = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { isSqlView } = useSmartsheetStoreOrThrow()

const lockType = computed(() => (activeView.value?.lock_type as LockType) || LockType.Collaborative)

// TODO: add 'json' when it's ready

const quickImportDialogTypes: QuickImportDialogType[] = ['csv', 'excel']

const isViewIdCopied = ref(false)

const quickImportDialogs: Record<(typeof quickImportDialogTypes)[number], Ref<boolean>> = quickImportDialogTypes.reduce(
  (acc: any, curr) => {
    acc[curr] = ref(false)
    return acc
  },
  {},
) as Record<QuickImportDialogType, Ref<boolean>>

const { isUIAllowed } = useRoles()

async function changeLockType(type: LockType) {
  $e('a:grid:lockmenu', { lockType: type })

  if (!activeView.value) return

  if (type === 'personal') {
    // Coming soon
    return message.info(t('msg.toast.futureRelease'))
  }
  try {
    activeView.value.lock_type = type
    await $api.dbView.update(activeView.value.id as string, {
      lock_type: type,
    })

    message.success(`Successfully Switched to ${type} view`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const { copy } = useCopy()

const onViewIdCopy = async () => {
  await copy(activeView.value!.id!)
  isViewIdCopied.value = true
}

/** Duplicate a view */
// todo: This is not really a duplication, maybe we need to implement a true duplication?
function onDuplicate() {
  isDropdownOpen.value = false
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isOpen,
    'title': activeView.value!.title,
    'type': activeView.value!.type as ViewTypes,
    'tableId': activeTable.value!.id,
    'selectedViewId': activeView.value!.id,
    'groupingFieldColumnId': activeView.value!.view!.fk_grp_col_id,
    'views': views,
    'onUpdate:modelValue': closeDialog,
    'onCreated': async (view: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews({
        force: true,
        tableId: activeTable.value!.id!,
      })

      navigateToView({
        view,
        tableId: activeTable.value!.id!,
        baseId: base.value.id!,
        hardReload: view.type === ViewTypes.FORM,
      })

      $e('a:view:create', { view: view.type })
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const onImportClick = (dialog: any) => {
  if (isLocked.value) return

  isDropdownOpen.value = false
  dialog.value = true
}

watch(isDropdownOpen, () => {
  setTimeout(() => {
    isViewIdCopied.value = false
  }, 250)
})
</script>

<template>
  <NcDropdown v-model:visible="isDropdownOpen">
    <div
      class="truncate nc-active-view-title !hover:(bg-gray-100 text-gray-800) ml-0.25 pl-1 pr-0.25 rounded-md py-1 cursor-pointer"
      :class="{
        'max-w-2/5': !isSharedBase && !isMobileMode && activeView?.is_default,
        'max-w-3/5': !isSharedBase && !isMobileMode && !activeView?.is_default,
        'max-w-1/2': isMobileMode,
        'text-gray-500': activeView?.is_default,
        'text-gray-800 font-medium': !activeView?.is_default,
      }"
    >
      <span
        class="truncate xs:pl-1.25 text-inherit"
        :class="{
          'max-w-28/100': !isMobileMode,
        }"
      >
        {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
      </span>
      <GeneralIcon icon="arrowDown" class="ml-1" />
    </div>
    <template #overlay>
      <NcMenu class="min-w-72">
        <div class="flex items-center justify-between py-2 px-2">
          <div class="flex text-xs font-bold text-gray-500 ml-1">VIEW ID: {{ activeView?.id }}</div>
          <NcTooltip>
            <template #title>Click to copy View ID</template>
            <NcButton size="xsmall" type="secondary" @click="onViewIdCopy">
              <GeneralIcon v-if="isViewIdCopied" icon="check" class="max-h-4 min-w-4" />
              <GeneralIcon v-else else icon="copy" class="max-h-4 min-w-4" />
            </NcButton>
          </NcTooltip>
        </div>
        <NcDivider />
        <template v-if="!activeView?.is_default">
          <NcMenuItem>
            <GeneralIcon icon="edit" />
            Rename View
          </NcMenuItem>
          <NcMenuItem @click="onDuplicate">
            <GeneralIcon icon="copy" />
            Duplicate View
          </NcMenuItem>
          <NcDivider />
        </template>

        <NcMenuItem-group>
          <template v-if="isUIAllowed('csvTableImport') && !isPublicView && !isSqlView">
            <NcSubMenu key="upload">
              <template #title>
                <div v-e="['c:navdraw:preview-as']" class="nc-base-menu-item group">
                  <UploadIcon class="w-4 h-4" />
                  {{ $t('general.upload') }}
                </div>
              </template>

              <template #expandIcon></template>
              <div class="flex py-3 px-4 font-bold uppercase text-xs text-gray-500">Upload Data</div>

              <template v-for="(dialog, type) in quickImportDialogs">
                <NcMenuItem v-if="isUIAllowed(`${type}TableImport`) && !isPublicView" :key="type" @click="onImportClick(dialog)">
                  <div v-e="[`a:upload:${type}`]" class="nc-base-menu-item" :class="{ disabled: isLocked }">
                    <component :is="iconMap.upload" />
                    {{ `${$t('general.upload')} ${type.toUpperCase()}` }}
                  </div>
                </NcMenuItem>
              </template>
            </NcSubMenu>
          </template>
          <NcSubMenu key="download">
            <template #title>
              <div v-e="['c:download']" class="nc-base-menu-item group">
                <DownloadIcon class="w-4 h-4" />
                {{ $t('general.download') }}
              </div>
            </template>

            <template #expandIcon></template>

            <LazySmartsheetToolbarExportSubActions />
          </NcSubMenu>

          <NcDivider />

          <NcSubMenu
            v-if="isUIAllowed('viewCreateOrEdit')"
            key="lock-type"
            class="scrollbar-thin-dull max-h-90vh overflow-auto !py-0"
          >
            <template #title>
              <div v-e="['c:navdraw:preview-as']" class="flex flex-row items-center gap-x-3">
                <div>View Settings</div>
                <div class="nc-base-menu-item flex !flex-shrink group !py-1 !px-1 rounded-md bg-brand-50">
                  <LazySmartsheetToolbarLockType
                    hide-tick
                    :type="lockType"
                    class="flex nc-view-actions-lock-type !text-brand-500 !flex-shrink"
                  />
                </div>
                <div class="flex flex-grow"></div>
              </div>
            </template>

            <template #expandIcon></template>
            <div class="flex py-3 px-4 font-bold uppercase text-xs text-gray-500">View Settings</div>
            <NcMenuItem class="nc-view-action-lock-subaction" @click="changeLockType(LockType.Collaborative)">
              <LazySmartsheetToolbarLockType :type="LockType.Collaborative" />
            </NcMenuItem>

            <NcMenuItem @click="changeLockType(LockType.Locked)">
              <LazySmartsheetToolbarLockType :type="LockType.Locked" />
            </NcMenuItem>
          </NcSubMenu>
        </NcMenuItem-group>
      </NcMenu>
    </template>
  </NcDropdown>

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
</template>

<style lang="scss" scoped>
.nc-base-menu-item {
  @apply !py-0;
}

.nc-view-actions-lock-type {
  @apply !min-w-0;
}
</style>

<style lang="scss">
.nc-view-actions-lock-type > div {
  @apply !py-0;
}

.nc-view-action-lock-subaction {
  @apply !min-w-82;
}
</style>
