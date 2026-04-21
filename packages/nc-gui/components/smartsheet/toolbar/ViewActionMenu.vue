<script lang="ts" setup>
import type { GalleryType, KanbanType, TableType, ViewType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, PlanFeatureTypes, PlanTitles, ViewTypes, viewTypeAlias } from 'nocodb-sdk'
import { LockType } from '#imports'

const props = withDefaults(
  defineProps<{
    view: ViewType
    table: TableType
    inSidebar?: boolean
    showOnlyCopyId?: boolean
  }>(),
  {
    inSidebar: false,
  },
)

const emits = defineEmits(['rename', 'closeModal', 'delete', 'descriptionUpdate', 'changeIcon'])

const { isUIAllowed, isDataReadOnly } = useRoles()

const isPublicView = inject(IsPublicInj, ref(false))

const { $e } = useNuxtApp()

const { t } = useI18n()

const view = computed(() => props.view)

const table = computed(() => props.table)

const viewsStore = useViewsStore()

const {
  navigateToView,
  duplicateView,
  updateView,
  updateViewMeta,
  onOpenCopyViewConfigFromAnotherViewModal,
  getCopyViewConfigBtnAccessStatus,
} = viewsStore

// Reactive views map for the whole store. We look up by the action target's
// own (baseId, tableId) rather than relying on the active-table view list,
// because the three-dot menu can be opened on a view that belongs to a table
// other than the currently-active one (e.g. from the sidebar tree while a
// different table is loaded).
const { viewsByTable } = storeToRefs(viewsStore)

const { base } = storeToRefs(useBase())

const { refreshCommandPalette } = useCommandPalette()

const { showEEFeatures, showRecordPlanLimitExceededModal, getPlanTitle } = useEeConfig()

const lockType = computed(() => (view.value?.lock_type as LockType) || LockType.Collaborative)

const currentSourceId = computed(() => table.value?.source_id)

// "Would converting/deleting THIS view leave the table with zero collab
// grid views?" Computed synchronously from the store's reactive
// `viewsByTable` map, keyed by the action target's own (baseId, tableId)
// so it works regardless of which table is currently active in the UI.
// Falls back to `false` (don't block) when the list is empty or doesn't
// include the current view — avoids spuriously disabling actions during
// initial load or on views the store hasn't seen yet.
const isLastGridViewInTable = computed(() => {
  const baseId = table.value?.base_id
  const tableId = table.value?.id
  if (!baseId || !tableId) return false
  const viewsList = viewsByTable.value.get(`${baseId}:${tableId}`) || []
  if (viewsList.length === 0) return false
  if (!viewsList.some((v) => v.id === view.value?.id)) return false
  const otherNonPersonalGrids = viewsList.filter(
    (v) => v.id !== view.value?.id && v.type === ViewTypes.GRID && v.lock_type !== LockType.Personal,
  )
  return otherNonPersonalGrids.length === 0
})

const onRenameMenuClick = () => {
  emits('rename')
}

const onDescriptionUpdateClick = () => {
  emits('descriptionUpdate')
}

const quickImportDialogTypes: ImportType[] = [ImportType.CSV, ImportType.EXCEL]

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
) as Record<ImportType, Ref<boolean>>

const onImportClick = (dialog: any) => {
  emits('closeModal')

  if (showRecordPlanLimitExceededModal()) return

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

const blockViewOperations = computed(() => {
  return isLastGridViewInTable.value && view.value?.type === ViewTypes.GRID
})

const lockTypeSwitchedMessage: Record<LockType, string> = {
  [LockType.Collaborative]: 'msg.toast.collabView',
  [LockType.Personal]: 'msg.toast.personalView',
  [LockType.Locked]: 'msg.toast.lockedView',
}

async function changeLockType(type: LockType) {
  if (!view.value) return

  if (view.value?.lock_type === type) {
    message.toast(t('msg.toast.alreadyInView', { type }))
    emits('closeModal')

    return
  }

  // if default view block the change since it's not allowed
  if (type === 'personal' && blockViewOperations.value) {
    return message.toast(t('msg.toast.notAllowedToChangeGridView'))
  }

  if (type === LockType.Locked || view.value.lock_type === LockType.Locked) {
    onLockTypeChange(type)

    return
  }

  $e(`a:${viewTypeAlias[view.value.type] || 'view'}:lockmenu`, { lockType: type, sidebar: props.inSidebar })

  try {
    view.value.lock_type = type

    await updateView(view.value?.id, {
      lock_type: type,
    })
    message.toast(t(lockTypeSwitchedMessage[type]))
  } catch (e: any) {
    message.toast(await extractSdkResponseErrorMsg(e))
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

  if (duplicatedView) {
    navigateToView({
      view: duplicatedView,
      tableId: table.value!.id!,
      tableTitle: table.value.title,
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

const onClickCopyViewConfig = () => {
  emits('closeModal')

  onOpenCopyViewConfigFromAnotherViewModal({ destView: view.value })
}

const isFieldHeaderVisibilityOptionVisible = computed(() => {
  return (
    !props.inSidebar &&
    isUIAllowed('viewCreateOrEdit') &&
    [ViewTypes.GALLERY, ViewTypes.KANBAN].includes(view.value?.type) &&
    isEeUI &&
    showEEFeatures.value
  )
})

const isFieldHeaderVisible = computed(() => {
  return parseProp((view.value?.view as GalleryType | KanbanType)?.meta)?.is_field_header_visible ?? true
})

const onToggleFieldHeaderVisibility = async () => {
  if (!view.value) {
    emits('closeModal')

    return
  }

  const payload = {
    ...parseProp((view.value?.view as GalleryType | KanbanType)?.meta),
    is_field_header_visible: !isFieldHeaderVisible.value,
  }

  view.value.meta = payload

  emits('closeModal')

  try {
    await updateViewMeta(view.value.id!, view.value.type, {
      meta: payload,
    })
  } catch (e: any) {
    // revert local changes on error
    view.value.meta = {
      ...payload,
      is_field_header_visible: !payload.is_field_header_visible,
    }

    const errorInfo = await extractSdkResponseErrorMsgv2(e)
    message.error('Error occurred while updating field header visibility', undefined, {
      copyText: errorInfo.message,
    })
  }
}

// View ownership, personal/locked state and derived permission checks all
// come from usePersonalViewPermissions to avoid drift with other components.
const { isPersonalView, isLockedView, isPersonalViewOwner, canModifyView, canDeleteView } = usePersonalViewPermissions(view)

// Tooltip shown when a modify-view action is disabled (rename, change icon, edit description).
const modifyViewDisabledReason = computed(() => {
  if (isLockedView.value) return t('msg.info.disabledAsViewLocked')
  if (isPersonalView.value && !isPersonalViewOwner.value) return t('tooltip.onlyViewOwnerCanModifyPersonalView')
  return ''
})

// Tooltip shown when Delete is disabled.
const deleteDisabledReason = computed(() => {
  if (isLockedView.value) return t('msg.info.disabledAsViewLocked')
  if (blockViewOperations.value && !isPersonalView.value) return t('msg.info.cantDeleteLastGridView')
  if (isPersonalView.value && !isPersonalViewOwner.value) return t('tooltip.onlyViewOwnerCanDeletePersonalView')
  return ''
})

// Deletion blocked if user lacks permission, or the view is the last grid view
// (which is enforced for everyone, including creators+).
const isDeleteDisabled = computed(() => {
  if (!canDeleteView.value) return true
  if (blockViewOperations.value && !isPersonalView.value) return true
  return false
})

// The Lock-type submenu is disabled when the user can't change this view's lock_type.
// - Not owner of a personal view (and can't reassign) → can't flip personal → anything.
// - Locked view + not creator+ (via fieldAdd) → can't unlock.
const disableLockTypeMenu = computed(() => {
  if (isPersonalView.value && !isPersonalViewOwner.value && !isUIAllowed('reAssignViewOwner')) return true
  if (isLockedView.value && !isUIAllowed('fieldAdd')) return true
  return false
})

// Tooltip shown when the whole view-mode submenu is disabled (so the user
// can hover the title and understand why it won't expand).
const lockTypeMenuDisabledReason = computed(() => {
  if (isPersonalView.value && !isPersonalViewOwner.value) return t('tooltip.onlyViewOwnerCanModifyPersonalView')
  if (isLockedView.value) return t('tooltip.onlyCreatorsCanUnlockView')
  return ''
})

const disablePersonalView = computed(() => {
  // Default grid view can't be made personal (would leave the table without a grid view)
  if (blockViewOperations.value) return true

  // Converting someone else's personal view is not allowed (they're already personal anyway)
  if (isPersonalView.value && !isPersonalViewOwner.value) return true

  // Unlocking a locked view requires creator+
  if (isLockedView.value && !isUIAllowed('fieldAdd')) return true

  return false
})

const disableCollaborativeOption = computed(() => {
  // Locked → Collab = unlock, only creator+
  if (isLockedView.value) return !isUIAllowed('fieldAdd')

  // Personal → Collab, owner or creator+
  if (isPersonalView.value) return !isPersonalViewOwner.value && !isUIAllowed('reAssignViewOwner')

  return false
})

// Tooltips shown on hover of each disabled view-mode option.
const collabOptionDisabledReason = computed(() => {
  if (isLockedView.value) return t('tooltip.onlyCreatorsCanUnlockView')
  if (isPersonalView.value && !isPersonalViewOwner.value) return t('tooltip.onlyOwnerOrCreatorCanReAssign')
  return ''
})

const personalOptionDisabledReason = computed(() => {
  if (blockViewOperations.value && !isPersonalView.value) return t('msg.toast.notAllowedToChangeGridView')
  if (isPersonalView.value && !isPersonalViewOwner.value) return t('tooltip.onlyViewOwnerCanModifyPersonalView')
  if (isLockedView.value && !isUIAllowed('fieldAdd')) return t('tooltip.onlyCreatorsCanUnlockView')
  return ''
})

const lockedOptionDisabledReason = computed(() => t('tooltip.onlyCreatorsCanLockView'))

// The "Assign as personal view" action (opens DlgReAssign to pick any user) is
// restricted to creator+. Editors can still convert a collab view to their own
// personal view via the View mode → Personal submenu option.
const disableAssignAsPersonalView = computed(() => {
  if (blockViewOperations.value) return true
  if (isLockedView.value && !isUIAllowed('fieldAdd')) return true
  if (!isUIAllowed('reAssignViewOwner')) return true
  return false
})

const isUploadAllowed = computed(() => {
  return (
    isUIAllowed('csvTableImport') && !isPublicView.value && !isDataReadOnly.value && table.value?.type !== 'view' // isSqlView
  )
})

const copyViewConfigMenuItemStatus = computed(() => {
  return getCopyViewConfigBtnAccessStatus(view.value, 'view-action-menu')
})

defineOptions({
  inheritAttrs: false,
})

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
    v-bind="$attrs"
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
    <template v-if="!showOnlyCopyId">
      <template v-if="isUIAllowed('viewCreateOrEdit')">
        <NcDivider />
        <template v-if="inSidebar">
          <NcMenuItem v-if="canModifyView" @click="onRenameMenuClick">
            <GeneralIcon icon="rename" class="opacity-80" />
            {{
              $t('general.renameEntity', {
                entity:
                  view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
              })
            }}
          </NcMenuItem>
          <NcTooltip v-else>
            <template #title> {{ modifyViewDisabledReason }} </template>
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
          <NcMenuItem v-if="canModifyView" @click="onDescriptionUpdateClick">
            <GeneralIcon icon="ncAlignLeft" class="opacity-80" />

            {{ $t('labels.editDescription') }}
          </NcMenuItem>
          <NcTooltip v-else>
            <template #title> {{ modifyViewDisabledReason }} </template>
            <NcMenuItem disabled>
              <GeneralIcon icon="ncAlignLeft" class="opacity-80" />
              {{ $t('labels.editDescription') }}
            </NcMenuItem>
          </NcTooltip>
          <NcMenuItemChangeIcon v-if="canModifyView" v-e="['c:view:change-icon']" @change-icon="emits('changeIcon')" />
          <NcTooltip v-else>
            <template #title> {{ modifyViewDisabledReason }} </template>
            <NcMenuItemChangeIcon disabled />
          </NcTooltip>
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

        <SmartsheetToolbarViewActionMenuMoveToSection
          v-if="isEeUI && showEEFeatures"
          :view="view"
          :table="table"
          :in-sidebar="inSidebar"
          @close-modal="emits('closeModal')"
        />
      </template>

      <SmartsheetToolbarNotAllowedTooltip
        v-if="copyViewConfigMenuItemStatus.isVisible && showEEFeatures"
        :enabled="copyViewConfigMenuItemStatus.isDisabled"
      >
        <template #title>
          <div class="max-w-70">
            {{ copyViewConfigMenuItemStatus.tooltip }}
          </div>
        </template>
        <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER">
          <template #default="{ click }">
            <NcMenuItem
              inner-class="w-full"
              :disabled="copyViewConfigMenuItemStatus.isDisabled"
              @click="click(PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER, () => onClickCopyViewConfig())"
            >
              <div
                v-e="[
                  'c:navdraw:copy-view-config-from-another-view',
                  {
                    sidebar: props.inSidebar,
                  },
                ]"
                class="w-full flex flex-row items-center gap-x-2"
              >
                <GeneralIcon icon="ncSettings2" class="opacity-80" />
                <div>
                  {{ $t('objects.copyViewConfig.copyAnotherViewConfig') }}
                </div>
                <div class="flex-1 w-full mr-1" />
                <LazyPaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER"
                  :limit-or-feature="'to access copy view configuration from another view feature.' as PlanFeatureTypes"
                  :content="
                    $t('upgrade.upgradeToAccessCopyViewConfigFromAnotherViewSubtitle', {
                      plan: getPlanTitle(PlanTitles.PLUS),
                    })
                  "
                  show-as-lock
                  :on-click-callback="() => emits('closeModal')"
                />
              </div>
            </NcMenuItem>
          </template>
        </PaymentUpgradeBadgeProvider>
      </SmartsheetToolbarNotAllowedTooltip>
      <template v-if="view.type !== ViewTypes.FORM">
        <NcDivider />
        <template v-if="isUploadAllowed">
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
              <PermissionsTooltip
                v-if="isUIAllowed(`${type}TableImport`) && !isPublicView"
                :key="type"
                :entity="PermissionEntity.TABLE"
                :entity-id="table.id"
                :permission="PermissionKey.TABLE_RECORD_ADD"
                placement="right"
                :description="$t('objects.permissions.uploadDataTooltip')"
              >
                <template #default="{ isAllowed }">
                  <NcMenuItem
                    :disabled="!isAllowed || !!table?.synced"
                    :title="!!table?.synced ? `You can't upload data in synced table` : undefined"
                    @click="onImportClick(dialog)"
                  >
                    <div
                      v-e="[
                        `a:upload:${type}`,
                        {
                          sidebar: props.inSidebar,
                        },
                      ]"
                      :class="{ disabled: lockType === LockType.Locked || !!table?.synced }"
                      class="nc-base-menu-item"
                    >
                      <component
                        :is="importAlias[type].icon"
                        v-if="importAlias[type]?.icon"
                        :class="{ 'opacity-80': isAllowed && !table?.synced, '!opacity-50': !isAllowed || !!table?.synced }"
                      />
                      {{ importAlias[type]?.title }}
                    </div>
                  </NcMenuItem>
                </template>
              </PermissionsTooltip>
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
          :disabled="disableLockTypeMenu"
          class="scrollbar-thin-dull max-h-90vh overflow-auto !py-0"
        >
          <template #title>
            <NcTooltip :disabled="!disableLockTypeMenu" :title="lockTypeMenuDisabledReason" placement="right" class="w-full">
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
                <div class="nc-base-menu-item flex !flex-shrink group !py-1 !px-1 rounded-md bg-nc-bg-brand">
                  <LazySmartsheetToolbarLockType
                    :type="lockType"
                    class="flex nc-view-actions-lock-type !text-nc-content-brand !flex-shrink !cursor-auto"
                    hide-tick
                  />
                </div>
                <div class="flex flex-grow"></div>
              </div>
            </NcTooltip>
          </template>

          <NcMenuItemLabel>
            {{ $t('labels.viewMode') }}
          </NcMenuItemLabel>
          <SmartsheetToolbarNotAllowedTooltip :enabled="disableCollaborativeOption">
            <template #title>
              <div class="max-w-80">{{ collabOptionDisabledReason }}</div>
            </template>
            <NcMenuItem
              class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction max-w-[100px]"
              data-testid="nc-view-action-lock-subaction-Collaborative"
              :disabled="disableCollaborativeOption"
              @click="changeLockType(LockType.Collaborative)"
            >
              <SmartsheetToolbarLockType :type="LockType.Collaborative" :disabled="disableCollaborativeOption" />
            </NcMenuItem>
          </SmartsheetToolbarNotAllowedTooltip>
          <SmartsheetToolbarNotAllowedTooltip v-if="isEeUI && showEEFeatures" :enabled="disablePersonalView">
            <template #title>
              <div class="max-w-80">{{ personalOptionDisabledReason }}</div>
            </template>
            <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS">
              <template #default="{ click }">
                <NcMenuItem
                  data-testid="nc-view-action-lock-subaction-Personal"
                  :disabled="disablePersonalView"
                  class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction max-w-[100px] children:w-full children:children:w-full group"
                  @click="click(PlanFeatureTypes.FEATURE_PERSONAL_VIEWS, () => changeLockType(LockType.Personal))"
                >
                  <SmartsheetToolbarLockType
                    :type="LockType.Personal"
                    :disabled="disablePersonalView"
                    @cancel="emits('closeModal')"
                  />
                </NcMenuItem>
              </template>
            </PaymentUpgradeBadgeProvider>
          </SmartsheetToolbarNotAllowedTooltip>
          <SmartsheetToolbarNotAllowedTooltip :enabled="!isUIAllowed('fieldAdd')">
            <template #title>
              <div class="max-w-80">{{ lockedOptionDisabledReason }}</div>
            </template>
            <NcMenuItem
              data-testid="nc-view-action-lock-subaction-Locked"
              class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction"
              :disabled="!isUIAllowed('fieldAdd')"
              @click="changeLockType(LockType.Locked)"
            >
              <SmartsheetToolbarLockType :type="LockType.Locked" :disabled="!isUIAllowed('fieldAdd')" />
            </NcMenuItem>
          </SmartsheetToolbarNotAllowedTooltip>
        </NcSubMenu>
        <template v-if="isEeUI && showEEFeatures">
          <SmartsheetToolbarNotAllowedTooltip
            v-if="isPersonalView"
            :enabled="!isUIAllowed('reAssignViewOwner')"
            :message="$t('tooltip.onlyOwnerOrCreatorCanReAssign')"
          >
            <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS">
              <template #default="{ click }">
                <NcMenuItem
                  inner-class="w-full"
                  :disabled="!isUIAllowed('reAssignViewOwner')"
                  @click="click(PlanFeatureTypes.FEATURE_PERSONAL_VIEWS, () => openReAssignDlg())"
                >
                  <div
                    v-e="[
                      'c:navdraw:reassign-personal-view',
                      {
                        sidebar: props.inSidebar,
                      },
                    ]"
                    class="w-full flex flex-row items-center gap-x-3"
                  >
                    <div>
                      {{ $t('labels.reAssignView') }}
                    </div>
                    <div class="flex-1 w-full" />
                    <LazyPaymentUpgradeBadge
                      :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS"
                      :limit-or-feature="'to access re-assign personal view feature.' as PlanFeatureTypes"
                      :content="
                        $t('upgrade.upgradeToAccessReassignViewSubtitle', {
                          plan: getPlanTitle(PlanTitles.PLUS),
                        })
                      "
                      :on-click-callback="() => emits('closeModal')"
                    />
                  </div>
                </NcMenuItem>
              </template>
            </PaymentUpgradeBadgeProvider>
          </SmartsheetToolbarNotAllowedTooltip>
          <SmartsheetToolbarNotAllowedTooltip
            v-else
            :enabled="disableAssignAsPersonalView"
            :message="
              blockViewOperations
                ? $t('tooltip.cantAssignLastNonPersonalView')
                : isLockedView
                ? $t('msg.info.disabledAsViewLocked')
                : $t('tooltip.onlyOwnerOrCreatorCanReAssign')
            "
          >
            <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS">
              <template #default="{ click }">
                <NcMenuItem
                  inner-class="w-full"
                  :disabled="disableAssignAsPersonalView"
                  @click="click(PlanFeatureTypes.FEATURE_PERSONAL_VIEWS, () => openReAssignDlg())"
                >
                  <div
                    v-e="[
                      'c:navdraw:assign-personal-view',
                      {
                        sidebar: props.inSidebar,
                      },
                    ]"
                    class="w-full flex flex-row items-center gap-x-2"
                  >
                    <GeneralIcon icon="ncUser" class="opacity-80" />
                    <div>
                      {{ $t('labels.assignAsPersonalView') }}
                    </div>
                    <div class="flex-1 w-full mr-1" />
                    <LazyPaymentUpgradeBadge
                      :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS"
                      :limit-or-feature="'to access assign as personal view feature.' as PlanFeatureTypes"
                      :content="
                        $t('upgrade.upgradeToAccessAssignAsPersonalViewSubtitle', {
                          plan: getPlanTitle(PlanTitles.PLUS),
                        })
                      "
                      show-as-lock
                      :on-click-callback="() => emits('closeModal')"
                    />
                  </div>
                </NcMenuItem>
              </template>
            </PaymentUpgradeBadgeProvider>
          </SmartsheetToolbarNotAllowedTooltip>
        </template>
        <PaymentUpgradeBadgeProvider
          v-if="isFieldHeaderVisibilityOptionVisible"
          :feature="PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY"
        >
          <template #default="{ click }">
            <NcMenuItem
              inner-class="w-full"
              @click="click(PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY, () => onToggleFieldHeaderVisibility())"
            >
              <GeneralIcon :icon="isFieldHeaderVisible ? 'eye' : 'eyeSlash'" class="!w-4 !h-4 opacity-80" />

              {{ isFieldHeaderVisible ? $t('labels.hideFieldHeader') : $t('labels.showFieldHeader') }}

              <div class="flex-1 w-full" />
              <LazyPaymentUpgradeBadge
                :feature="PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY"
                :limit-or-feature="'to access card field header visibility feature.' as PlanFeatureTypes"
                :content="
                  $t('upgrade.upgradeToAccessCardFieldHeaderVisibilitySubtitle', {
                    plan: getPlanTitle(PlanTitles.PLUS),
                  })
                "
                :on-click-callback="() => emits('closeModal')"
                show-as-lock
              />
            </NcMenuItem>
          </template>
        </PaymentUpgradeBadgeProvider>
      </template>

      <template v-if="isUIAllowed('viewCreateOrEdit')">
        <NcDivider />
        <NcTooltip v-if="isDeleteDisabled" placement="right">
          <template #title>
            {{ deleteDisabledReason }}
          </template>
          <NcMenuItem disabled>
            <GeneralIcon class="nc-view-delete-icon opacity-80" icon="delete" />
            {{
              $t('general.deleteEntity', {
                entity:
                  view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
              })
            }}
          </NcMenuItem>
        </NcTooltip>
        <NcMenuItem v-else danger @click="onDelete">
          <GeneralIcon class="nc-view-delete-icon opacity-80" icon="delete" />
          {{
            $t('general.deleteEntity', {
              entity: view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
            })
          }}
        </NcMenuItem>
      </template>
    </template>
  </NcMenu>
  <span v-else v-bind="$attrs"></span>

  <template v-if="table?.base_id && currentSourceId && isUploadAllowed">
    <!-- Don't add this inside the NcMenu else it will show 2 modals at the same time -->
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
