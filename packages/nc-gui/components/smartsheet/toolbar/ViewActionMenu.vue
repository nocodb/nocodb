<script lang="ts" setup>
import type { TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { LockType } from '~/lib'

import UploadIcon from '~icons/nc-icons/upload'
import DownloadIcon from '~icons/nc-icons/download'

const props = defineProps<{
  view: ViewType
  table: TableType
  inSidebar: boolean
}>()

const emits = defineEmits(['rename', 'closeModal', 'delete'])

const { isUIAllowed } = useRoles()

const isPublicView = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const view = computed(() => props.view)

const table = computed(() => props.table)

const { viewsByTable } = storeToRefs(useViewsStore())
const { loadViews, navigateToView } = useViewsStore()

const { base } = storeToRefs(useBase())

const { refreshCommandPalette } = useCommandPalette()

const lockType = computed(() => (view.value?.lock_type as LockType) || LockType.Collaborative)

const views = computed(() => viewsByTable.value.get(table.value.id!))

const isViewIdCopied = ref(false)

const currentBaseId = computed(() => table.value?.source_id)

const onRenameMenuClick = () => {
  emits('rename')
}

const quickImportDialogTypes: QuickImportDialogType[] = ['csv', 'excel']

const quickImportDialogs: Record<(typeof quickImportDialogTypes)[number], Ref<boolean>> = quickImportDialogTypes.reduce(
  (acc: any, curr) => {
    acc[curr] = ref(false)
    return acc
  },
  {},
) as Record<QuickImportDialogType, Ref<boolean>>

const onImportClick = (dialog: any) => {
  if (isLocked.value) return

  emits('closeModal')
  dialog.value = true
}

async function changeLockType(type: LockType) {
  $e('a:grid:lockmenu', { lockType: type, sidebar: props.inSidebar })

  if (!view.value) return

  if (type === 'personal') {
    // Coming soon
    return message.info(t('msg.toast.futureRelease'))
  }
  try {
    view.value.lock_type = type
    await $api.dbView.update(view.value.id as string, {
      lock_type: type,
    })

    message.success(`Successfully Switched to ${type} view`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  emits('closeModal')
}

/** Duplicate a view */
// todo: This is not really a duplication, maybe we need to implement a true duplication?
function onDuplicate() {
  emits('closeModal')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isOpen,
    'title': view.value!.title,
    'type': view.value!.type as ViewTypes,
    'tableId': table.value!.id,
    'selectedViewId': view.value!.id,
    'groupingFieldColumnId': view.value!.view!.fk_grp_col_id,
    'views': views,
    'onUpdate:modelValue': closeDialog,
    'onCreated': async (view: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews({
        force: true,
        tableId: table.value!.id!,
      })

      navigateToView({
        view,
        tableId: table.value!.id!,
        baseId: base.value.id!,
        hardReload: view.type === ViewTypes.FORM,
      })

      $e('a:view:create', { view: view.type, sidebar: props.inSidebar })
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const { copy } = useCopy()

const onViewIdCopy = async () => {
  await copy(view.value!.id!)
  isViewIdCopied.value = true
}

const onDelete = async () => {
  emits('delete')
}
</script>

<template>
  <NcMenu class="!min-w-70" data-id="toolbar-actions" :data-testid="`view-sidebar-view-actions-${view!.alias || view!.title}`">
    <NcTooltip>
      <template #title> {{ $t('labels.clickToCopyViewID') }} </template>
      <div class="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-gray-100 group" @click="onViewIdCopy">
        <div class="flex text-xs font-bold text-gray-500 ml-1">
          {{
            $t('labels.viewIdColon', {
              viewId: view?.id,
            })
          }}
        </div>
        <NcButton size="xsmall" type="secondary" class="!group-hover:bg-gray-100">
          <GeneralIcon v-if="isViewIdCopied" icon="check" class="max-h-4 min-w-4" />
          <GeneralIcon v-else else icon="copy" class="max-h-4 min-w-4" />
        </NcButton>
      </div>
    </NcTooltip>
    <NcDivider />
    <template v-if="!view?.is_default">
      <NcMenuItem @click="onRenameMenuClick">
        <GeneralIcon icon="edit" />
        {{ $t('activity.renameView') }}
      </NcMenuItem>
      <NcMenuItem @click="onDuplicate">
        <GeneralIcon icon="duplicate" class="nc-view-copy-icon" />
        {{ $t('labels.duplicateView') }}
      </NcMenuItem>
      <NcDivider />
    </template>

    <template v-if="view.type !== ViewTypes.FORM">
      <template v-if="isUIAllowed('csvTableImport') && !isPublicView">
        <NcSubMenu key="upload">
          <template #title>
            <div
              v-e="[
                'c:navdraw:preview-as',
                {
                  sidebar: props.inSidebar,
                },
              ]"
              class="nc-base-menu-item group"
            >
              <UploadIcon class="w-4 h-4" />
              {{ $t('general.upload') }}
            </div>
          </template>

          <template #expandIcon></template>
          <div class="flex py-3 px-4 font-bold uppercase text-xs text-gray-500">{{ $t('activity.uploadData') }}</div>

          <template v-for="(dialog, type) in quickImportDialogs">
            <NcMenuItem v-if="isUIAllowed(`${type}TableImport`) && !isPublicView" :key="type" @click="onImportClick(dialog)">
              <div
                v-e="[
                  `a:upload:${type}`,
                  {
                    sidebar: props.inSidebar,
                  },
                ]"
                class="nc-base-menu-item"
                :class="{ disabled: isLocked }"
              >
                <component :is="iconMap.upload" />
                {{ `${$t('general.upload')} ${type.toUpperCase()}` }}
              </div>
            </NcMenuItem>
          </template>
        </NcSubMenu>
      </template>
      <NcSubMenu key="download">
        <template #title>
          <div
            v-e="[
              'c:download',
              {
                sidebar: props.inSidebar,
              },
            ]"
            class="nc-base-menu-item group nc-view-context-download-option"
          >
            <DownloadIcon class="w-4 h-4" />
            {{ $t('general.download') }}
          </div>
        </template>

        <template #expandIcon></template>

        <LazySmartsheetToolbarExportSubActions />
      </NcSubMenu>
      <NcDivider />
    </template>

    <NcSubMenu v-if="isUIAllowed('viewCreateOrEdit')" key="lock-type" class="scrollbar-thin-dull max-h-90vh overflow-auto !py-0">
      <template #title>
        <div
          v-e="[
            'c:navdraw:preview-as',
            {
              sidebar: props.inSidebar,
            },
          ]"
          class="flex flex-row items-center gap-x-3"
        >
          <div>
            {{ $t('labels.viewMode') }}
          </div>
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
      <div class="flex py-3 px-4 font-bold uppercase text-xs text-gray-500">{{ $t('labels.viewMode') }}</div>
      <a-menu-item class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction">
        <LazySmartsheetToolbarLockType :type="LockType.Collaborative" @click="changeLockType(LockType.Collaborative)" />
      </a-menu-item>

      <a-menu-item class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction">
        <LazySmartsheetToolbarLockType :type="LockType.Locked" @click="changeLockType(LockType.Locked)" />
      </a-menu-item>
    </NcSubMenu>
    <template v-if="!view.is_default">
      <NcDivider />
      <NcMenuItem class="!hover:bg-red-50 !text-red-500" @click="onDelete">
        <GeneralIcon icon="delete" class="nc-view-delete-icon" />
        {{
          $t('general.deleteEntity', {
            entity: $t('objects.view'),
          })
        }}
      </NcMenuItem>
    </template>
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
  </NcMenu>
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
