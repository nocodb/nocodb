<script setup lang="ts">
import type { ColumnType, ViewType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey } from 'nocodb-sdk'

interface Props {
  isLoading?: boolean
  templateMode?: boolean
  blueprintMode?: boolean
  view?: ViewType
  // Side-panel header is space-constrained — drop the standalone copy-URL
  // button and surface "Copy URL" inside the dropdown instead.
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  templateMode: false,
  blueprintMode: false,
  compact: false,
})

const emits = defineEmits<{
  duplicateStart: []
  duplicateApplied: []
  afterDelete: []
  requestClose: []
}>()

const { isUIAllowed } = useRoles()

const { dashboardUrl } = useDashboard()

const { copy } = useCopy()

const { appInfo, isMobileMode } = useGlobal()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const { t } = useI18n()

const route = useRoute()

const router = useRouter()

const isPublic = inject(IsPublicInj, ref(false))

const injectedView = inject(ActiveViewInj, ref())

const view = computed(() => props.view ?? injectedView.value)

const { isSqlView } = useSmartsheetStoreOrThrow()

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const expandedFormStore = useExpandedFormStoreOrThrow()

const { isNew, primaryKey, displayValue, baseRoles, meta, row: _row, loadRow: _loadRow, deleteRowById } = expandedFormStore

const { mode: expandedFormMode, toggle: toggleExpandedFormMode } = useExpandedFormMode()

// Panel store is provided by tabs/Smartsheet — only present when the user is on
// a grid view inside a Smartsheet tab. In other contexts (kanban modal,
// dashboard widgets) the toggle hides itself.
const expandedFormPanelStore = useExpandedFormPanel()

// Switching between panel and modal only makes sense on EE desktop where both
// surfaces exist AND a panel store is in scope (i.e., grid view on Smartsheet).
const showModeToggle = computed(
  () => isEeUI && !isMobileMode.value && !props.templateMode && !props.blueprintMode && !!expandedFormPanelStore,
)

const onToggleMode = async () => {
  // Capture state BEFORE toggling — primaryKey/_row reactive refs belong to the
  // current surface's store, which will be torn down when we close it.
  const rowId = primaryKey.value
  const capturedRow = _row.value
  const fromMode = expandedFormMode.value

  toggleExpandedFormMode()

  message.toast(fromMode === 'panel' ? t('msg.toast.expandedFormModeExpandedForm') : t('msg.toast.expandedFormModeSidePanel'))

  if (!rowId || !expandedFormPanelStore) return

  // Both directions: closing the current surface clears rowId from the route
  // (panel close watch in grid/index.vue, modal v-model setter). Re-push it
  // after the close so the new surface stays addressable / reload-safe.
  if (fromMode === 'panel') {
    // panel → modal: route-based modal opens automatically once rowId is
    // present and expandedFormOnRowIdDlg sees mode === 'modal'.
    expandedFormPanelStore.closePanel()
    await nextTick()
    router.push({ query: { ...router.currentRoute.value.query, rowId } })
  } else {
    // modal → panel: open the panel imperatively with the row data we already
    // have, then re-push rowId. rowIndex is unknown (the modal doesn't track
    // one), so prev/next stay disabled until the user navigates from the grid.
    emits('requestClose')
    expandedFormPanelStore.openPanel(capturedRow, undefined, undefined, rowId)
    await nextTick()
    router.push({ query: { ...router.currentRoute.value.query, rowId } })
  }
}

const isRecordLinkCopied = ref(false)

const showSendRecordModal = ref(false)

const showDeleteRowModal = ref(false)

const visibleMoreOptions = computed(() => {
  if (props.templateMode || props.blueprintMode) {
    return {
      reloadRecord: false,
      copyRecordUrl: false,
      sendRecord: false,
      duplicateRecord: false,
      modeToggle: false,
      deleteRecord: false,
      showDeleteDivider: false,
      showMoreOptionsMenu: false,
      allHiddenExceptCopyRecordUrl: true,
    }
  }

  const result = {
    reloadRecord: !isEeUI,
    copyRecordUrl: !isNew.value && !!primaryKey.value,
    sendRecord: appInfo.value.ee && !isNew.value && !!primaryKey.value && !isPublic.value,
    duplicateRecord: isUIAllowed('dataEdit', baseRoles.value) && !isSqlView.value && !isMobileMode.value,
    modeToggle: showModeToggle.value,
    deleteRecord: !isNew.value && isUIAllowed('dataEdit', baseRoles.value) && !isSqlView.value,
  }

  const hasItemsAboveDelete = Object.entries(result).some(([key, value]) => key !== 'deleteRecord' && value)

  return {
    ...result,
    showDeleteDivider: result.deleteRecord && hasItemsAboveDelete,
    showMoreOptionsMenu: hasItemsAboveDelete || result.deleteRecord,
    // Only meaningful when there's a standalone copy-URL button — in compact mode
    // the dropdown is the ONLY surface for copy-URL, so it must always render.
    allHiddenExceptCopyRecordUrl:
      !props.compact &&
      !result.reloadRecord &&
      !result.sendRecord &&
      !result.duplicateRecord &&
      !result.modeToggle &&
      !result.deleteRecord,
  }
})

const displayField = computed(() => (meta.value?.columns ?? []).find((c: ColumnType) => c.pv) ?? null)

const copyRecordUrl = async () => {
  const url = `${dashboardUrl?.value}/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}${
    view.value ? `/${view.value.id}` : ''
  }?rowId=${primaryKey.value}${route.query?.path ? `&path=${route.query?.path}` : ''}`

  await copy(encodeURI(url))

  isRecordLinkCopied.value = true

  await ncDelay(5000)

  isRecordLinkCopied.value = false
}

const onDuplicateRow = () => {
  if (showRecordPlanLimitExceededModal()) return

  emits('duplicateStart')

  const oldRow = { ..._row.value.row }
  delete oldRow.ncRecordId
  delete oldRow.ncRecordHash
  const newRow = { row: oldRow, oldRow: {}, rowMeta: { new: true } } as Row

  setTimeout(async () => {
    _row.value = newRow
    emits('duplicateApplied')
    message.toast(t('msg.success.rowDuplicatedWithoutSavedYet'))
  }, 500)
}

const onDeleteRowClick = () => {
  showDeleteRowModal.value = true
}

const onConfirmDeleteRowClick = async () => {
  await deleteRowById(primaryKey.value || undefined)

  emits('afterDelete')
  showDeleteRowModal.value = false

  await reloadViewDataTrigger.trigger({
    shouldShowLoading: false,
    skipLoadingRowId: primaryKey.value || undefined,
  })
}
</script>

<template>
  <NcTooltip v-if="visibleMoreOptions.copyRecordUrl && !isMobileMode && !compact" class="!<lg:hidden">
    <template #title>
      {{ isRecordLinkCopied ? $t('labels.copiedRecordURL') : $t('labels.copyRecordURL') }}
    </template>
    <NcButton
      :disabled="isLoading"
      class="text-nc-content-inverted-secondary !h-7 !w-7"
      type="text"
      size="xsmall"
      @click="copyRecordUrl()"
    >
      <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex items-center relative h-4 w-4">
        <Transition name="icon-fade" :duration="200">
          <component :is="iconMap.check" v-if="isRecordLinkCopied" class="cursor-pointer nc-duplicate-row h-4 w-4" />
          <component :is="iconMap.copy" v-else class="cursor-pointer nc-duplicate-row h-4 w-4" />
        </Transition>
      </div>
    </NcButton>
  </NcTooltip>

  <NcDropdown
    v-if="visibleMoreOptions.showMoreOptionsMenu"
    placement="bottomRight"
    :class="{
      '!lg:hidden': visibleMoreOptions.allHiddenExceptCopyRecordUrl,
    }"
  >
    <NcButton
      :type="isMobileMode ? 'secondary' : 'text'"
      size="xsmall"
      class="nc-expand-form-more-actions !w-7 !h-7"
      :class="{
        '!lg:hidden': visibleMoreOptions.allHiddenExceptCopyRecordUrl,
      }"
      :disabled="isLoading"
    >
      <GeneralIcon
        icon="threeDotVertical"
        class="text-md"
        :class="isLoading ? 'text-nc-content-brand-hover' : 'text-nc-content-inverted-secondary'"
      />
    </NcButton>
    <template #overlay>
      <NcMenu variant="small">
        <NcMenuItem v-if="visibleMoreOptions.reloadRecord" @click="_loadRow()">
          <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
            <component :is="iconMap.reload" class="cursor-pointer" />
            {{ $t('general.reload') }} {{ $t('objects.record') }}
          </div>
        </NcMenuItem>
        <NcMenuItem
          v-if="visibleMoreOptions.copyRecordUrl"
          type="secondary"
          :class="{ '!lg:hidden': !compact }"
          :disabled="isLoading"
          @click="copyRecordUrl()"
        >
          <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex gap-2 items-center">
            <component :is="iconMap.copy" class="cursor-pointer" />
            {{ $t('labels.copyRecordURL') }}
          </div>
        </NcMenuItem>
        <NcMenuItem v-if="visibleMoreOptions.sendRecord" :disabled="isLoading" @click="showSendRecordModal = true">
          <div v-e="['c:row-expand:send-record']" data-testid="nc-expanded-form-send-record" class="flex gap-2 items-center">
            <GeneralIcon icon="mail" class="cursor-pointer" />
            {{ $t('activity.sendRecord') }}
          </div>
        </NcMenuItem>
        <NcTooltip v-if="visibleMoreOptions.duplicateRecord && meta?.synced" placement="left">
          <template #title>
            {{ $t('msg.info.duplicateNotAvailableForSyncedTable') }}
          </template>
          <NcMenuItem disabled>
            <div class="flex gap-2 items-center" data-testid="nc-expanded-form-duplicate">
              <component :is="iconMap.duplicate" class="cursor-pointer nc-duplicate-row" />
              <span class="-ml-0.25">
                {{ $t('labels.duplicateRecord') }}
              </span>
            </div>
          </NcMenuItem>
        </NcTooltip>
        <PermissionsTooltip
          v-else-if="visibleMoreOptions.duplicateRecord"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_ADD"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcMenuItem :disabled="!isAllowed" @click="!isNew ? onDuplicateRow() : () => {}">
              <div v-e="['c:row-expand:duplicate']" class="flex gap-2 items-center" data-testid="nc-expanded-form-duplicate">
                <component :is="iconMap.duplicate" class="cursor-pointer nc-duplicate-row" />
                <span class="-ml-0.25">
                  {{ $t('labels.duplicateRecord') }}
                </span>
              </div>
            </NcMenuItem>
          </template>
        </PermissionsTooltip>
        <NcMenuItem v-if="visibleMoreOptions.modeToggle" data-testid="nc-expanded-form-toggle-mode" @click="onToggleMode">
          <div
            v-e="[`c:row-expand:toggle-mode:${expandedFormMode === 'panel' ? 'modal' : 'panel'}`]"
            class="flex gap-2 items-center"
          >
            <GeneralIcon :icon="expandedFormMode === 'panel' ? 'expand' : 'sidebar'" class="cursor-pointer w-4 h-4" />
            <span class="-ml-0.25">
              {{ expandedFormMode === 'panel' ? $t('labels.switchToExpandedForm') : $t('labels.switchToSidePanel') }}
            </span>
          </div>
        </NcMenuItem>
        <NcDivider v-if="visibleMoreOptions.showDeleteDivider" />
        <NcTooltip v-if="visibleMoreOptions.deleteRecord && meta?.synced" placement="left">
          <template #title>
            {{ $t('msg.info.deleteNotAvailableForSyncedTable') }}
          </template>
          <NcMenuItem danger disabled>
            <div class="flex gap-2 items-center" data-testid="nc-expanded-form-delete">
              <GeneralIcon icon="delete" class="cursor-pointer nc-delete-row" />
              <span class="-ml-0.25">
                {{
                  $t('general.deleteEntity', {
                    entity: $t('objects.record').toLowerCase(),
                  })
                }}
              </span>
            </div>
          </NcMenuItem>
        </NcTooltip>
        <PermissionsTooltip
          v-else-if="visibleMoreOptions.deleteRecord"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_DELETE"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcMenuItem danger :disabled="!isAllowed" @click="!isNew && onDeleteRowClick()">
              <div v-e="['c:row-expand:delete']" class="flex gap-2 items-center" data-testid="nc-expanded-form-delete">
                <GeneralIcon icon="delete" class="cursor-pointer nc-delete-row" />
                <span class="-ml-0.25">
                  {{
                    $t('general.deleteEntity', {
                      entity: $t('objects.record').toLowerCase(),
                    })
                  }}
                </span>
              </div>
            </NcMenuItem>
          </template>
        </PermissionsTooltip>
      </NcMenu>
    </template>
  </NcDropdown>

  <GeneralDeleteModal v-model:visible="showDeleteRowModal" entity-name="Record" :on-delete="onConfirmDeleteRowClick">
    <template #entity-preview>
      <span>
        <div
          class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-inverted-secondary"
        >
          <div class="text-ellipsis overflow-hidden select-none w-full pl-1.75 break-keep whitespace-nowrap">
            <LazySmartsheetPlainCell v-model="displayValue" :column="displayField" />
          </div>
        </div>
      </span>
    </template>
  </GeneralDeleteModal>

  <DlgSendRecordEmail
    v-if="visibleMoreOptions.sendRecord && primaryKey"
    v-model="showSendRecordModal"
    :meta="meta"
    :view="view"
    :row-id="primaryKey"
  />
</template>
