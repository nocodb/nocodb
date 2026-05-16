<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { PlanLimitTypes, UITypes } from 'nocodb-sdk'
import { SmartsheetStoreEvents } from '#imports'

// Bulk-action menu shown when the user has 2+ column headers selected on the
// grid. Mirrors the layout of the single-column ColumnMenu but every action
// fans out over `columns`.
const props = defineProps<{
  isOpen: boolean
  columns: ColumnType[]
  onCleared?: () => void
}>()

const emit = defineEmits(['update:isOpen'])

const isOpen = useVModel(props, 'isOpen', emit)

const { eventBus, allFilters } = useSmartsheetStoreOrThrow()

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { gridViewCols, fieldsMap, hidingViewColumnsMap } = useViewColumnsOrThrow()

const { fieldsToGroupBy, groupByLimit, groupBy } = useViewGroupByOrThrow()

const { isUIAllowed } = useRoles()

const { getPlanLimit } = useWorkspace()

const showMultiDeleteModal = ref(false)

const showMultiPermissionsModal = ref(false)

const isHiding = ref(false)

const columnCount = computed(() => props.columns.length)

const closeAndClear = () => {
  isOpen.value = false
  props.onCleared?.()
}

// --- Hide ---------------------------------------------------------------

const hideAllSelected = async () => {
  if (!props.columns.length || !view.value?.id) return
  isHiding.value = true
  try {
    const viewColumnList = (
      await $api.internal.getOperation(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
        operation: 'viewColumnList',
        viewId: view.value!.id!,
      })
    ).list

    // Optimistic local update — keep the menu snappy while API calls fan out.
    for (const col of props.columns) {
      if (!col.id) continue
      if (fieldsMap.value[col.id]?.show) {
        hidingViewColumnsMap.value[col.id] = true
        fieldsMap.value[col.id].show = false
      }
    }

    await Promise.all(
      props.columns.map(async (col) => {
        if (!col.id) return
        const viewCol = gridViewCols.value[col.id] ?? viewColumnList.find((f: any) => f.fk_column_id === col.id)
        if (!viewCol) return
        try {
          await $api.internal.postOperation(
            meta.value!.fk_workspace_id!,
            meta.value!.base_id!,
            {
              operation: 'viewColumnUpdate',
              viewId: view.value!.id!,
              columnId: viewCol.id!,
            },
            { show: false },
          )
        } finally {
          delete hidingViewColumnsMap.value[col.id]
        }
      }),
    )

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    reloadDataHook?.trigger()
    $e('a:field:hide:multi', { count: columnCount.value })
  } catch (e: any) {
    // Roll back the optimistic flip for any column still flagged as hiding.
    for (const col of props.columns) {
      if (!col.id) continue
      if (hidingViewColumnsMap.value[col.id]) {
        fieldsMap.value[col.id].show = true
        delete hidingViewColumnsMap.value[col.id]
      }
    }
    message.error(t('msg.error.columnVisibilityUpdateFailed'))
  } finally {
    isHiding.value = false
    closeAndClear()
  }
}

// --- Filter -------------------------------------------------------------

const isFilterSupportedFor = (col: ColumnType) => ![UITypes.QrCode, UITypes.Barcode, UITypes.Button].includes(col.uidt as UITypes)

const filterableColumns = computed(() => props.columns.filter(isFilterSupportedFor))

const isAnyFilterable = computed(() => filterableColumns.value.length > 0)

const filterPerViewLimit = computed(() => getPlanLimit(PlanLimitTypes.LIMIT_FILTER_PER_VIEW))

const currentFilterCount = computed(() => allFilters.value.filter((f) => !(f.is_group || f.status === 'delete')).length)

const filterRemainingSlots = computed(() => Math.max(0, filterPerViewLimit.value - currentFilterCount.value))

const isFilterLimitBlocking = computed(() => filterableColumns.value.length > filterRemainingSlots.value)

const filterByAllSelected = () => {
  if (!isAnyFilterable.value || isFilterLimitBlocking.value) return
  // Single event with a `columns` payload — ColumnFilterMenu's listener
  // commits one draft at a time and waits for each addFilter to resolve.
  eventBus.emit(SmartsheetStoreEvents.FILTER_ADD, { columns: filterableColumns.value })
  $e('a:field:filter:multi', { count: filterableColumns.value.length })
  closeAndClear()
}

// --- Group by -----------------------------------------------------------

const groupableColumns = computed(() => {
  const groupableSet = new Set((fieldsToGroupBy.value || []).map((f) => f.id))
  return props.columns.filter((c) => c.id && groupableSet.has(c.id))
})

const isAnyGroupable = computed(() => groupableColumns.value.length > 0)

const groupRemainingSlots = computed(() => Math.max(0, groupByLimit - groupBy.value.length))

const isGroupLimitBlocking = computed(() => groupableColumns.value.length > groupRemainingSlots.value)

const groupByAllSelected = () => {
  if (!isAnyGroupable.value || isGroupLimitBlocking.value) return
  // Single event with a `columns` payload — GroupByMenu's listener pushes them
  // all and persists once, avoiding saveGroupBy races.
  eventBus.emit(SmartsheetStoreEvents.GROUP_BY_ADD, { columns: groupableColumns.value })
  $e('a:field:groupby:multi', { count: groupableColumns.value.length })
  closeAndClear()
}

// --- Delete -------------------------------------------------------------

const onDelete = () => {
  isOpen.value = false
  showMultiDeleteModal.value = true
}

// --- Permissions --------------------------------------------------------

const onPermissions = () => {
  isOpen.value = false
  showMultiPermissionsModal.value = true
}

const onDeleted = () => {
  eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
  reloadDataHook?.trigger()
  props.onCleared?.()
}

const onPermissionsSaved = () => {
  props.onCleared?.()
}
</script>

<template>
  <NcMenu
    variant="small"
    class="flex flex-col gap-1 border-nc-border-gray-medium nc-multi-column-options !min-w-60 nc-max-h-screen nc-scrollbar-thin"
  >
    <div class="px-3 py-1.5 text-caption text-nc-content-gray-subtle">
      {{ t('labels.nFieldsSelected', { count: columnCount }) }}
    </div>

    <NcDivider />

    <NcMenuItem
      v-if="isEeUI && !isPublic && isUIAllowed('permissionEdit')"
      data-testid="nc-multi-field-permissions"
      @click="onPermissions"
    >
      <div v-e="['a:field:permissions:multi']" class="nc-multi-column-permissions nc-header-menu-item">
        <GeneralIcon icon="ncLock" class="opacity-80 !w-4 !h-4" />
        {{ t('labels.editNFieldPermissions', { count: columnCount }) }}
      </div>
    </NcMenuItem>

    <NcDivider v-if="isEeUI && !isPublic && isUIAllowed('permissionEdit')" />

    <NcTooltip :disabled="isAnyFilterable && !isFilterLimitBlocking">
      <template #title>
        {{
          !isAnyFilterable
            ? t('tooltip.thisFieldTypeDoesNotSupportFiltering')
            : isFilterLimitBlocking
            ? t('tooltip.filterByLimitExceeded')
            : ''
        }}
      </template>
      <NcMenuItem
        :disabled="isLocked || !isAnyFilterable || isFilterLimitBlocking"
        data-testid="nc-multi-field-filter"
        @click="filterByAllSelected"
      >
        <div class="nc-multi-column-filter nc-header-menu-item">
          <component :is="iconMap.filter" class="opacity-80" />
          {{ t('activity.filterByTheseFields') }}
        </div>
      </NcMenuItem>
    </NcTooltip>

    <NcTooltip :disabled="(isAnyGroupable && !isGroupLimitBlocking) || !(isEeUI && !isPublic)">
      <template #title>
        {{
          !isAnyGroupable
            ? t('tooltip.thisFieldTypeDoesNotSupportGrouping')
            : isGroupLimitBlocking
            ? t('tooltip.groupByLimitExceeded')
            : ''
        }}
      </template>
      <NcMenuItem
        :disabled="isLocked || !isAnyGroupable || isGroupLimitBlocking"
        data-testid="nc-multi-field-groupby"
        @click="groupByAllSelected"
      >
        <div class="nc-multi-column-groupby nc-header-menu-item">
          <component :is="iconMap.group" class="opacity-80" />
          {{ t('activity.groupByNFields', { count: columnCount }) }}
        </div>
      </NcMenuItem>
    </NcTooltip>

    <NcDivider />

    <NcMenuItem :disabled="isLocked || isHiding" data-testid="nc-multi-field-hide" @click="hideAllSelected">
      <div class="nc-multi-column-hide nc-header-menu-item">
        <GeneralLoader v-if="isHiding" size="regular" />
        <component :is="iconMap.eyeSlash" v-else class="!w-4 !h-4 opacity-80" />
        {{ t('labels.hideNFields', { count: columnCount }) }}
      </div>
    </NcMenuItem>

    <NcMenuItem v-if="isUIAllowed('fieldDelete')" danger data-testid="nc-multi-field-delete" @click="onDelete">
      <div class="nc-multi-column-delete nc-header-menu-item">
        <component :is="iconMap.delete" class="opacity-80" />
        {{ t('labels.deleteNFields', { count: columnCount }) }}
      </div>
    </NcMenuItem>

    <div class="non-menu-items">
      <SmartsheetHeaderMultiDeleteColumnModal v-model:visible="showMultiDeleteModal" :columns="columns" :on-deleted="onDeleted" />
      <DlgFieldMultiPermissions
        v-if="isEeUI && meta"
        v-model:visible="showMultiPermissionsModal"
        :columns="columns"
        @saved="onPermissionsSaved"
      />
    </div>
  </NcMenu>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply !w-full;
}

:deep(.nc-header-menu-item) {
  @apply text-dropdown flex items-center gap-2;
}

.nc-multi-column-options {
  .nc-icons {
    @apply !w-5 !h-5;
  }
}
</style>
