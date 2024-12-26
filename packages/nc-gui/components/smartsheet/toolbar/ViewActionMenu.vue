<script lang="ts" setup>
import { ProjectRoles, type TableType, type ViewType, WorkspaceUserRoles } from 'nocodb-sdk'
import { ViewTypes, viewTypeAlias } from 'nocodb-sdk'
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

const { user } = useGlobal()

const { base } = storeToRefs(useBase())

const { refreshCommandPalette } = useCommandPalette()

const lockType = computed(() => (view.value?.lock_type as LockType) || LockType.Collaborative)

const currentSourceId = computed(() => table.value?.source_id)

const onRenameMenuClick = () => {
  emits('rename')
}

const onDescriptionUpdateClick = () => {
  emits('descriptionUpdate')
}

const quickImportDialogTypes: QuickImportDialogType[] = ['csv', 'excel']

const importAlias = {
  csv: {
    title: 'CSV',
    icon: iconMap.ncFileTypeCsvSmall,
  },
  excel: {
    title: 'Excel',
    icon: iconMap.ncFileTypeExcel,
  },
}

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

const onLockTypeChange = (type: LockType) => {
  const { close } = useDialog(resolveComponent('DlgLockView'), {
    'modelValue': ref(true),
    'onUpdate:modelValue': () => {
      close()
    },
    'changeType': type,
    view,
  })

  emits('closeModal')
}

async function changeLockType(type: LockType) {
  if (!view.value) return

  if (view.value?.lock_type === type) {
    message.success(`Already in ${type} view`)
    emits('closeModal')

    return
  }

  // if default view block the change since it's not allowed
  if (type === 'personal' && view.value.is_default) {
    return message.info(t('msg.toast.notAllowedToChangeDefaultView'))
  }

  if (type === LockType.Locked || view.value.lock_type === LockType.Locked) {
    onLockTypeChange(type)

    return
  }

  $e(`a:${viewTypeAlias[view.value.type] || 'view'}:lockmenu`, { lockType: type, sidebar: props.inSidebar })

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

const onDelete = async () => {
  emits('delete')
}

const openReAssignDlg = () => {
  const { close } = useDialog(resolveComponent('DlgReAssign'), {
    'modelValue': ref(true),
    'onUpdate:modelValue': () => {
      close()
    },
    view,
  })

  emits('closeModal')
}

const isViewOwner = computed(() => {
  return (
    view.value?.owned_by === user.value?.id ||
    (!view.value?.owned_by &&
      (user.value.base_roles?.[ProjectRoles.OWNER] || user.value.workspace_roles?.[WorkspaceUserRoles.OWNER]))
  )
})

const isDefaultView = computed(() => view.value?.is_default)

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
    variant="small"
  >
    <NcMenuItemCopyId
      v-if="view"
      :id="view.id"
      :tooltip="$t('labels.clickToCopyViewID')"
      :label="
        $t('labels.viewIdColon', {
          viewId: view?.id,
        })
      "
    />

    <template v-if="!view?.is_default && isUIAllowed('viewCreateOrEdit')">
      <NcDivider />
      <template v-if="inSidebar">
        <NcMenuItem v-if="lockType !== LockType.Locked" @click="onRenameMenuClick">
          <GeneralIcon icon="rename" class="opacity-80" />
          {{
            $t('general.renameEntity', {
              entity: view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
            })
          }}
        </NcMenuItem>
        <NcTooltip v-else>
          <template #title> {{ $t('msg.info.disabledAsViewLocked') }} </template>
          <NcMenuItem disabled>
            <GeneralIcon icon="rename" class="opacity-80" />
            {{
              $t('general.renameEntity', {
                entity:
                  view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
              })
            }}
          </NcMenuItem>
        </NcTooltip>
        <NcMenuItem v-show="lockType !== LockType.Locked" @click="onDescriptionUpdateClick">
          <GeneralIcon icon="ncAlignLeft" class="opacity-80" />
          {{ $t('general.edit') }}

          {{ $t('labels.description') }}
        </NcMenuItem>
      </template>
      <NcMenuItem @click="onDuplicate">
        <GeneralLoader v-if="isOnDuplicateLoading" size="regular" />
        <GeneralIcon v-else class="nc-view-copy-icon opacity-80" icon="duplicate" />
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
        <NcSubMenu key="upload" variant="small">
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
              <GeneralIcon icon="upload" class="opacity-80" />
              {{ $t('general.upload') }}
            </div>
          </template>

          <NcMenuItemLabel>
            {{ $t('activity.uploadData') }}
          </NcMenuItemLabel>

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
                <component :is="importAlias[type].icon" v-if="importAlias[type]?.icon" class="opacity-80" />
                {{ importAlias[type]?.title }}
              </div>
            </NcMenuItem>
          </template>
        </NcSubMenu>
      </template>
      <NcSubMenu key="download" variant="small">
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
            <GeneralIcon icon="download" class="opacity-80" />
            {{ $t('general.download') }}
          </div>
        </template>

        <LazySmartsheetToolbarExportSubActions />
      </NcSubMenu>
    </template>

    <template v-if="isUIAllowed('viewCreateOrEdit')">
      <NcDivider />
      <NcSubMenu
        key="lock-type"
        variant="small"
        :disabled="!isViewOwner && !isUIAllowed('reAssignViewOwner') && view.lock_type === LockType.Personal"
        class="scrollbar-thin-dull max-h-90vh overflow-auto !py-0"
      >
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
                class="flex nc-view-actions-lock-type !text-brand-500 !flex-shrink !cursor-auto"
                hide-tick
              />
            </div>
            <div class="flex flex-grow"></div>
          </div>
        </template>

        <NcMenuItemLabel>
          {{ $t('labels.viewMode') }}
        </NcMenuItemLabel>
        <NcMenuItem
          class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction max-w-[100px]"
          data-testid="nc-view-action-lock-subaction-Collaborative"
          :disabled="!isUIAllowed('fieldAdd')"
          @click="changeLockType(LockType.Collaborative)"
        >
          <LazySmartsheetToolbarLockType :type="LockType.Collaborative" :disabled="!isUIAllowed('fieldAdd')" />
        </NcMenuItem>
        <SmartsheetToolbarNotAllowedTooltip
          v-if="isEeUI"
          :enabled="!isViewOwner || !!isDefaultView"
          :message="isDefaultView ? 'Default view can\'t be made personal' : 'Only view owner can change to personal view'"
        >
          <NcMenuItem
            data-testid="nc-view-action-lock-subaction-Personal"
            :disabled="!isViewOwner || !!isDefaultView"
            class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction max-w-[100px]"
            @click="changeLockType(LockType.Personal)"
          >
            <LazySmartsheetToolbarLockType :type="LockType.Personal" :disabled="!isViewOwner || isDefaultView" />
          </NcMenuItem>
        </SmartsheetToolbarNotAllowedTooltip>
        <NcMenuItem
          data-testid="nc-view-action-lock-subaction-Locked"
          class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction"
          :disabled="!isUIAllowed('fieldAdd')"
          @click="changeLockType(LockType.Locked)"
        >
          <LazySmartsheetToolbarLockType :type="LockType.Locked" :disabled="!isUIAllowed('fieldAdd')" />
        </NcMenuItem>
      </NcSubMenu>
      <SmartsheetToolbarNotAllowedTooltip
        v-if="isEeUI && !isDefaultView"
        :enabled="!(isViewOwner || isUIAllowed('reAssignViewOwner'))"
        message="Only owner or creator can re-assign"
      >
        <NcMenuItem :disabled="!(isViewOwner || isUIAllowed('reAssignViewOwner'))" @click="openReAssignDlg">
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
              {{ $t('labels.reAssignView') }}
            </div>
            <div class="flex flex-grow"></div>
          </div>
        </NcMenuItem>
      </SmartsheetToolbarNotAllowedTooltip>
    </template>

    <template v-if="!view.is_default && isUIAllowed('viewCreateOrEdit')">
      <NcDivider />
      <NcTooltip v-if="lockType === LockType.Locked">
        <template #title> {{ $t('msg.info.disabledAsViewLocked') }} </template>
        <NcMenuItem class="!cursor-not-allowed !text-gray-400" disabled>
          <GeneralIcon class="nc-view-delete-icon opacity-80" icon="delete" />
          {{
            $t('general.deleteEntity', {
              entity: view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
            })
          }}
        </NcMenuItem>
      </NcTooltip>
      <NcMenuItem v-else class="!hover:bg-red-50 !text-red-500" @click="onDelete">
        <GeneralIcon class="nc-view-delete-icon opacity-80" icon="delete" />
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
