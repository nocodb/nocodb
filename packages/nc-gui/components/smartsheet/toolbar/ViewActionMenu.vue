<script lang="ts" setup>
import type { TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { LockType } from '#imports'

const props = withDefaults(
  defineProps<{
    view: ViewType
    table: TableType
    inSidebar?: boolean
  }>(),
  {
    inSidebar: false,
  },
)

const emits = defineEmits(['rename', 'closeModal', 'delete', 'descriptionUpdate'])

const { isUIAllowed, isDataReadOnly } = useRoles()

const isPublicView = inject(IsPublicInj, ref(false))

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const view = computed(() => props.view)

const table = computed(() => props.table)

const { loadViews, navigateToView, duplicateView } = useViewsStore()

const { base } = storeToRefs(useBase())

const { refreshCommandPalette } = useCommandPalette()

const lockType = computed(() => (view.value?.lock_type as LockType) || LockType.Collaborative)

const isViewIdCopied = ref(false)

const currentSourceId = computed(() => table.value?.source_id)

const onRenameMenuClick = () => {
  emits('rename')
}

const onDescriptionUpdateClick = () => {
  emits('descriptionUpdate')
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
  if (lockType.value === LockType.Locked) return

  emits('closeModal')
  dialog.value = true
}

async function changeLockType(type: LockType) {
  $e('a:grid:lockmenu', { lockType: type, sidebar: props.inSidebar })

  if (!view.value) return

  // if default view block the change since it's not allowed
  if (type === 'personal' && view.value.is_default) {
    return message.info(t('msg.toast.notAllowedToChangeDefaultView'))
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

const isOnDuplicateLoading = ref<boolean>(false)

/** Duplicate a view */
// todo: This is not really a duplication, maybe we need to implement a true duplication?
async function onDuplicate() {
  isOnDuplicateLoading.value = true
  const duplicatedView = await duplicateView(view.value)

  refreshCommandPalette()

  await loadViews({
    force: true,
    tableId: table.value!.id!,
  })

  if (duplicatedView) {
    navigateToView({
      view: duplicatedView,
      tableId: table.value!.id!,
      baseId: base.value.id!,
      hardReload: duplicatedView.type === ViewTypes.FORM,
    })

    $e('a:view:create', { view: duplicatedView.type, sidebar: true })
  }

  isOnDuplicateLoading.value = false
  emits('closeModal')
}

const { copy } = useCopy()

const onViewIdCopy = async () => {
  await copy(view.value!.id!)
  isViewIdCopied.value = true
}

const onDelete = async () => {
  emits('delete')
}

/**
 * ## Known Issue and Fix
 * - **Issue**: When conditionally rendering `NcMenuItem` using `v-if` without a corresponding `v-else` fallback,
 *   Vue may throw a
 * `NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`.
 *
 * - This issue occurs specifically when the `NcMenu` is open, and the condition changes dynamically (e.g., during runtime state changes)
 *
 * - **Fix**: Use `v-show` instead of `v-if` when no replacement (fallback) node is provided. This keeps the element
 *   in the DOM but toggles its visibility, preventing the DOM manipulation issue.
 */
</script>

<template>
  <NcMenu
    v-if="view"
    :data-testid="`view-sidebar-view-actions-${view!.alias || view!.title}`"
    class="!min-w-70"
    data-id="toolbar-actions"
  >
    <NcTooltip>
      <template #title> {{ $t('labels.clickToCopyViewID') }} </template>
      <div
        class="flex items-center justify-between p-2 mx-1.5 rounded-md cursor-pointer hover:bg-gray-100 group"
        @click="onViewIdCopy"
      >
        <div class="flex text-xs font-bold text-gray-500 ml-1">
          {{
            $t('labels.viewIdColon', {
              viewId: view?.id,
            })
          }}
        </div>
        <NcButton class="!group-hover:bg-gray-100" size="xsmall" type="secondary">
          <GeneralIcon v-if="isViewIdCopied" class="max-h-4 min-w-4" icon="check" />
          <GeneralIcon v-else class="max-h-4 min-w-4" else icon="copy" />
        </NcButton>
      </div>
    </NcTooltip>

    <template v-if="!view?.is_default && isUIAllowed('viewCreateOrEdit')">
      <NcDivider />
      <template v-if="inSidebar">
        <NcMenuItem v-if="lockType !== LockType.Locked" @click="onRenameMenuClick">
          <GeneralIcon icon="rename" />
          {{
            $t('general.renameEntity', {
              entity: view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
            })
          }}
        </NcMenuItem>
        <NcTooltip v-else>
          <template #title> {{ $t('msg.info.disabledAsViewLocked') }} </template>
          <NcMenuItem class="!cursor-not-allowed !text-gray-400">
            <GeneralIcon icon="rename" />
            {{
              $t('general.renameEntity', {
                entity:
                  view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
              })
            }}
          </NcMenuItem>
        </NcTooltip>
        <NcMenuItem v-show="lockType !== LockType.Locked" @click="onDescriptionUpdateClick">
          <GeneralIcon icon="ncAlignLeft" />
          {{ $t('general.edit') }}

          {{ $t('labels.description') }}
        </NcMenuItem>
      </template>
      <NcMenuItem @click="onDuplicate">
        <GeneralLoader v-if="isOnDuplicateLoading" size="regular" />
        <GeneralIcon v-else class="nc-view-copy-icon" icon="duplicate" />
        {{
          $t('general.duplicateEntity', {
            entity: view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
          })
        }}
      </NcMenuItem>
    </template>
    <template v-if="view.type !== ViewTypes.FORM">
      <NcDivider />
      <template v-if="isUIAllowed('csvTableImport') && !isPublicView && !isDataReadOnly">
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
              <GeneralIcon icon="upload" />
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
                :class="{ disabled: lockType === LockType.Locked }"
                class="nc-base-menu-item"
              >
                <component :is="iconMap.cloudUpload" />
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
            <GeneralIcon icon="download" />
            {{ $t('general.download') }}
          </div>
        </template>

        <template #expandIcon></template>

        <LazySmartsheetToolbarExportSubActions />
      </NcSubMenu>
    </template>

    <template v-if="isUIAllowed('viewCreateOrEdit')">
      <NcDivider />

      <NcSubMenu key="lock-type" class="scrollbar-thin-dull max-h-90vh overflow-auto !py-0">
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
                :type="lockType"
                class="flex nc-view-actions-lock-type !text-brand-500 !flex-shrink"
                hide-tick
              />
            </div>
            <div class="flex flex-grow"></div>
          </div>
        </template>

        <template #expandIcon></template>
        <div class="flex py-3 px-4 font-bold uppercase text-xs text-gray-500">{{ $t('labels.viewMode') }}</div>
        <a-menu-item class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction max-w-[100px]">
          <LazySmartsheetToolbarLockType :type="LockType.Collaborative" @click="changeLockType(LockType.Collaborative)" />
        </a-menu-item>

        <a-menu-item class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction max-w-[100px]">
          <LazySmartsheetToolbarLockType :type="LockType.Personal" @click="changeLockType(LockType.Personal)" />
        </a-menu-item>

        <a-menu-item class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction">
          <LazySmartsheetToolbarLockType :type="LockType.Locked" @click="changeLockType(LockType.Locked)" />
        </a-menu-item>
      </NcSubMenu>
    </template>

    <template v-if="!view.is_default && isUIAllowed('viewCreateOrEdit')">
      <NcDivider />
      <NcTooltip v-if="lockType === LockType.Locked">
        <template #title> {{ $t('msg.info.disabledAsViewLocked') }} </template>
        <NcMenuItem class="!cursor-not-allowed !text-gray-400">
          <GeneralIcon class="nc-view-delete-icon" icon="delete" />
          {{
            $t('general.deleteEntity', {
              entity: view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
            })
          }}
        </NcMenuItem>
      </NcTooltip>
      <NcMenuItem v-else class="!hover:bg-red-50 !text-red-500" @click="onDelete">
        <GeneralIcon class="nc-view-delete-icon" icon="delete" />
        {{
          $t('general.deleteEntity', {
            entity: view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
          })
        }}
      </NcMenuItem>
    </template>
    <template v-if="table?.base_id && currentSourceId">
      <LazyDlgQuickImport
        v-for="tp in quickImportDialogTypes"
        :key="tp"
        v-model="quickImportDialogs[tp].value"
        :import-data-only="true"
        :import-type="tp"
        :base-id="table.base_id"
        :source-id="currentSourceId"
      />
    </template>
  </NcMenu>
  <span v-else></span>
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
