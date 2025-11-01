<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles, type TableType, type ViewType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, ViewTypes, viewTypeAlias } from 'nocodb-sdk'
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

const emits = defineEmits(['rename', 'closeModal', 'delete', 'descriptionUpdate'])

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
  isUserViewOwner,
  onOpenCopyViewConfigFromAnotherViewModal,
  getCopyViewConfigBtnAccessStatus,
} = viewsStore

const { base } = storeToRefs(useBase())

const { refreshCommandPalette } = useCommandPalette()

const { showRecordPlanLimitExceededModal, getPlanTitle } = useEeConfig()

const lockType = computed(() => (view.value?.lock_type as LockType) || LockType.Collaborative)

const currentSourceId = computed(() => table.value?.source_id)

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

    await updateView(view.value?.id, {
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

const isViewOwner = computed(() => {
  return isUserViewOwner(view.value)
})

const isDefaultView = computed(() => view.value?.is_default)

const isPersonalView = computed(() => view.value?.lock_type === LockType.Personal)

const disablePersonalView = computed(() => {
  // Default view can't be made personal
  if (isDefaultView.value) return true

  // If view is not owned by the current user, then disable
  if (!isViewOwner.value) return true

  return false
})

const isUploadAllowed = computed(() => {
  return (
    isUIAllowed('csvTableImport') &&
    !isPublicView.value &&
    !isDataReadOnly.value &&
    table.value?.type !== 'view' && // isSqlView
    !table.value?.synced
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
      <template v-if="!view?.is_default && isUIAllowed('viewCreateOrEdit')">
        <NcDivider />
        <template v-if="inSidebar">
          <NcMenuItem v-if="lockType !== LockType.Locked" @click="onRenameMenuClick">
            <GeneralIcon icon="rename" class="opacity-80" />
            {{
              $t('general.renameEntity', {
                entity:
                  view.type !== ViewTypes.FORM ? $t('objects.view').toLowerCase() : $t('objects.viewType.form').toLowerCase(),
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

            {{ $t('labels.editDescription') }}
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

      <NcDivider v-if="copyViewConfigMenuItemStatus.isVisible && view?.is_default" />
      <SmartsheetToolbarNotAllowedTooltip
        v-if="copyViewConfigMenuItemStatus.isVisible"
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
                  <NcMenuItem :disabled="!isAllowed" @click="onImportClick(dialog)">
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
                      <component
                        :is="importAlias[type].icon"
                        v-if="importAlias[type]?.icon"
                        :class="{ 'opacity-80': isAllowed, '!opacity-50': !isAllowed }"
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
          :disabled="!isViewOwner && !isUIAllowed('reAssignViewOwner') && isPersonalView"
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
            <SmartsheetToolbarLockType :type="LockType.Collaborative" :disabled="!isUIAllowed('fieldAdd')" />
          </NcMenuItem>
          <SmartsheetToolbarNotAllowedTooltip
            v-if="isEeUI"
            :enabled="disablePersonalView"
            :message="isDefaultView ? 'Default view can\'t be made personal' : 'Only view owner can change to personal view'"
          >
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
          <NcMenuItem
            data-testid="nc-view-action-lock-subaction-Locked"
            class="!mx-1 !py-2 !rounded-md nc-view-action-lock-subaction"
            :disabled="!isUIAllowed('fieldAdd')"
            @click="changeLockType(LockType.Locked)"
          >
            <SmartsheetToolbarLockType :type="LockType.Locked" :disabled="!isUIAllowed('fieldAdd')" />
          </NcMenuItem>
        </NcSubMenu>
        <template v-if="isEeUI && !isDefaultView">
          <SmartsheetToolbarNotAllowedTooltip
            v-if="isPersonalView"
            :enabled="!(isViewOwner || isUIAllowed('reAssignViewOwner'))"
            :message="$t('tooltip.onlyOwnerOrCreatorCanReAssign')"
          >
            <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS">
              <template #default="{ click }">
                <NcMenuItem
                  inner-class="w-full"
                  :disabled="!(isViewOwner || isUIAllowed('reAssignViewOwner'))"
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
            :enabled="!isViewOwner"
            :message="$t('tooltip.onlyViewOwnerCanAssignAsPersonalView')"
          >
            <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS">
              <template #default="{ click }">
                <NcMenuItem
                  inner-class="w-full"
                  :disabled="!isViewOwner"
                  @click="click(PlanFeatureTypes.FEATURE_PERSONAL_VIEWS, () => openReAssignDlg())"
                >
                  <div
                    v-e="[
                      'c:navdraw:assign-personal-view',
                      {
                        sidebar: props.inSidebar,
                      },
                    ]"
                    class="w-full flex flex-row items-center gap-x-3"
                  >
                    <div>
                      {{ $t('labels.assignAsPersonalView') }}
                    </div>
                    <div class="flex-1 w-full" />
                    <LazyPaymentUpgradeBadge
                      :feature="PlanFeatureTypes.FEATURE_PERSONAL_VIEWS"
                      :limit-or-feature="'to access assign as personal view feature.' as PlanFeatureTypes"
                      :content="
                        $t('upgrade.upgradeToAccessAssignAsPersonalViewSubtitle', {
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
        </template>
      </template>

      <template v-if="!view.is_default && isUIAllowed('viewCreateOrEdit')">
        <NcDivider />
        <NcTooltip v-if="lockType === LockType.Locked">
          <template #title> {{ $t('msg.info.disabledAsViewLocked') }} </template>
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
