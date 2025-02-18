<script lang="ts" setup>
import {
  type ColumnReqType,
  type ColumnType,
  columnTypeName,
  partialUpdateAllowedTypes,
  readonlyMetaAllowedTypes,
} from 'nocodb-sdk'
import { PlanLimitTypes, RelationTypes, UITypes, isLinksOrLTAR, isSupportedDisplayValueColumn, isSystemColumn } from 'nocodb-sdk'
import { SmartsheetStoreEvents } from '#imports'

const props = defineProps<{ virtual?: boolean; isOpen: boolean; isHiddenCol?: boolean; column: ColumnType }>()

const emit = defineEmits(['edit', 'addColumn', 'update:isOpen'])

const virtual = toRef(props, 'virtual')

const isOpen = useVModel(props, 'isOpen', emit)

const column = toRef(props, 'column')
provide(ColumnInj, column)

const { eventBus, allFilters } = useSmartsheetStoreOrThrow()

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const { insertSort } = useViewSorts(view, () => reloadDataHook?.trigger())

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const { addUndo, defineModelScope, defineViewScope } = useUndoRedo()

const showDeleteColumnModal = ref(false)

const { gridViewCols } = useViewColumnsOrThrow()

const { fieldsToGroupBy, groupByLimit } = useViewGroupByOrThrow(view)

const { isUIAllowed, isMetaReadOnly, isDataReadOnly } = useRoles()

const isLoading = ref<'' | 'hideOrShow' | 'setDisplay'>('')

const setAsDisplayValue = async () => {
  isLoading.value = 'setDisplay'
  try {
    const currentDisplayValue = meta?.value?.columns?.find((f) => f.pv)

    isOpen.value = false

    await $api.dbTableColumn.primaryColumnSet(column?.value?.id as string)

    await getMeta(meta?.value?.id as string, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    $e('a:column:set-primary')

    addUndo({
      redo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
        },
        args: [column?.value?.id as string],
      },
      undo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
        },
        args: [currentDisplayValue?.id],
      },
      scope: defineModelScope({ model: meta.value }),
    })
  } catch (e) {
    message.error(t('msg.error.primaryColumnUpdateFailed'))
  } finally {
    isLoading.value = ''
  }
}

const sortByColumn = async (direction: 'asc' | 'desc') => {
  await insertSort({
    column: column!.value,
    direction,
    reloadDataHook,
  })
}

const isDuplicateDlgOpen = ref(false)
const selectedColumnExtra = ref<any>()
const duplicateDialogRef = ref<any>()

const duplicateVirtualColumn = async () => {
  let columnCreatePayload = {}

  // generate duplicate column title
  const duplicateColumnTitle = getUniqueColumnName(`${column!.value.title} copy`, meta!.value!.columns!)

  columnCreatePayload = {
    ...column!.value!,
    ...(column!.value.colOptions ?? {}),
    title: duplicateColumnTitle,
    column_name: duplicateColumnTitle.replace(/\s/g, '_'),
    id: undefined,
    colOptions: undefined,
    order: undefined,
    system: false,
  }

  try {
    const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

    const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)
    let newColumnOrder
    if (currentColumnIndex === gridViewColumnList.length - 1) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order! + 1
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1].order!) / 2
    }

    await $api.dbTableColumn.create(meta!.value!.id!, {
      ...columnCreatePayload,
      pv: false,
      view_id: view.value!.id as string,
      column_order: {
        order: newColumnOrder,
        view_id: view.value!.id as string,
      },
    } as ColumnReqType)
    await getMeta(meta!.value!.id!, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    reloadDataHook?.trigger()

    // message.success(t('msg.success.columnDuplicated'))
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  // closing dropdown
  isOpen.value = false
}

const openDuplicateDlg = async () => {
  if (!column?.value) return
  if (
    column.value.uidt &&
    [
      UITypes.Lookup,
      UITypes.Rollup,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ].includes(column.value.uidt as UITypes)
  ) {
    duplicateVirtualColumn()
  } else {
    const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

    const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)
    let newColumnOrder
    if (currentColumnIndex === gridViewColumnList.length - 1) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order! + 1
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1].order!) / 2
    }

    selectedColumnExtra.value = {
      pv: false,
      view_id: view.value!.id as string,
      column_order: {
        order: newColumnOrder,
        view_id: view.value!.id as string,
      },
    }

    if (column.value.uidt === UITypes.Formula || column.value.uidt === UITypes.Button) {
      nextTick(() => {
        duplicateDialogRef?.value?.duplicate()
      })
    } else {
      isDuplicateDlgOpen.value = true
    }

    isOpen.value = false
  }
}

// add column before or after current column
const addColumn = async (before = false) => {
  const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

  const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)

  let newColumnOrder
  if (before) {
    if (currentColumnIndex === 0) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order / 2
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex - 1]?.order) / 2
    }
  } else {
    if (currentColumnIndex === gridViewColumnList.length - 1) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order + 1
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1]?.order) / 2
    }
  }

  emit('addColumn', {
    column_order: {
      order: newColumnOrder,
      view_id: view.value?.id as string,
    },
  })
}

const getViewId = () => {
  if (meta.value?.id !== view.value?.fk_model_id) {
    return meta.value?.views?.find((v) => v.is_default)?.id
  }

  return view.value?.id
}

const updateDefaultViewColVisibility = (columnId?: string, show = false) => {
  //  Don't update meta if it is not default view
  if (!meta.value || !columnId || meta.value?.id !== view.value?.fk_model_id || !view.value?.is_default) return

  meta.value.columns = (meta.value.columns || []).map((c: ColumnType) => {
    if (c.id !== columnId) return c

    c.meta = { ...parseProp(c.meta || {}), defaultViewColVisibility: show }
    return c
  })

  if (meta.value?.columnsById?.[columnId]) {
    meta.value.columnsById[columnId].meta = {
      ...parseProp(meta.value.columnsById[columnId].meta),
      defaultViewColVisibility: show,
    }
  }
}

// hide the field in view
const hideOrShowField = async () => {
  isLoading.value = 'hideOrShow'

  const viewId = getViewId() as string

  try {
    const gridViewColumnList = (await $api.dbViewColumn.list(viewId)).list

    const currentColumn = gridViewColumnList.find((f) => f.fk_column_id === column!.value.id)

    await $api.dbViewColumn.update(view.value!.id!, currentColumn!.id!, { show: !currentColumn.show })

    if (isExpandedForm.value) {
      await getMeta(meta?.value?.id as string, true)
    } else {
      updateDefaultViewColVisibility(column?.value.id, !currentColumn.show)
    }

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    if (!currentColumn.show) {
      reloadDataHook?.trigger()
    }

    addUndo({
      redo: {
        fn: async function redo(id: string, fk_column_id: string, show: boolean) {
          await $api.dbViewColumn.update(viewId, id, { show: !show })

          if (isExpandedForm.value) {
            await getMeta(meta?.value?.id as string, true)
          } else {
            updateDefaultViewColVisibility(fk_column_id, !show)
          }

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
          if (!show) {
            reloadDataHook?.trigger()
          }
        },
        args: [currentColumn!.id, currentColumn!.fk_column_id, currentColumn.show],
      },
      undo: {
        fn: async function undo(id: string, fk_column_id: string, show: boolean) {
          await $api.dbViewColumn.update(viewId, id, { show })

          if (isExpandedForm.value) {
            await getMeta(meta?.value?.id as string, true)
          } else {
            updateDefaultViewColVisibility(fk_column_id, show)
          }

          await Promise.all(promises)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
          reloadDataHook?.trigger()
          if (show) {
            reloadDataHook?.trigger()
          }
        },
        args: [currentColumn!.id, currentColumn!.fk_column_id, currentColumn.show],
      },
      scope: defineViewScope({ view: view.value }),
    })
  } catch (e: any) {
    console.log('error', e)
    message.error(t('msg.error.columnVisibilityUpdateFailed'))
  }

  isLoading.value = ''
  isOpen.value = false
}

const handleDelete = () => {
  // closing the dropdown
  // when modal opens
  isOpen.value = false
  showDeleteColumnModal.value = true
}

const onEditPress = (event?: MouseEvent, enableDescription = false) => {
  isOpen.value = false
  emit('edit', event, enableDescription, column.value)
}

const onInsertBefore = () => {
  isOpen.value = false
  addColumn(true)
}
const onInsertAfter = () => {
  isOpen.value = false
  addColumn()
}

const isDeleteAllowed = computed(() => {
  return column?.value && !isSystemColumn(column.value)
})
const isDuplicateAllowed = computed(() => {
  return (
    column?.value &&
    !column.value.system &&
    ((!isMetaReadOnly.value && !isDataReadOnly.value) || readonlyMetaAllowedTypes.includes(column.value?.uidt)) &&
    !column.value.meta?.custom
  )
})
const isFilterSupported = computed(
  () =>
    !!(meta.value?.columns || []).find(
      (f) => f.id === column?.value?.id && ![UITypes.QrCode, UITypes.Barcode, UITypes.Button].includes(f.uidt),
    ),
)

const isSortSupported = computed(
  () => !!(meta.value?.columns || []).find((f) => f.id === column?.value?.id && ![UITypes.Button].includes(f.uidt)),
)

const { getPlanLimit } = useWorkspace()

const isFilterLimitExceeded = computed(
  () =>
    allFilters.value.filter((f) => !(f.is_group || f.status === 'delete')).length >= getPlanLimit(PlanLimitTypes.FILTER_LIMIT),
)

const isGroupedByThisField = computed(() => !!gridViewCols.value[column?.value?.id]?.group_by)

const isGroupBySupported = computed(() => !!(fieldsToGroupBy.value || []).find((f) => f.id === column?.value?.id))

const isGroupByLimitExceeded = computed(() => {
  const groupBy = Object.values(gridViewCols.value).filter((c) => c.group_by)
  return !(fieldsToGroupBy.value.length && fieldsToGroupBy.value.length > groupBy.length && groupBy.length < groupByLimit)
})

const filterOrGroupByThisField = (event: SmartsheetStoreEvents) => {
  if (column?.value) {
    eventBus.emit(event, column.value)
  }
  isOpen.value = false
}

const isColumnUpdateAllowed = computed(() => {
  if (isMetaReadOnly.value && !readonlyMetaAllowedTypes.includes(column.value?.uidt)) return false
  return true
})

const isColumnEditAllowed = computed(() => {
  if (
    isMetaReadOnly.value &&
    !readonlyMetaAllowedTypes.includes(column.value?.uidt) &&
    !partialUpdateAllowedTypes.includes(column.value?.uidt)
  )
    return false
  return true
})

// check if the column is associated as foreign key in any of the link column
const linksAssociated = computed(() => {
  return meta.value?.columns?.filter(
    (c) => isLinksOrLTAR(c) && [c.colOptions?.fk_child_column_id, c.colOptions?.fk_parent_column_id].includes(column?.value?.id),
  )
})

const addLookupMenu = ref(false)

const openLookupMenuDialog = () => {
  isOpen.value = false
  addLookupMenu.value = true
}

const changeTitleFieldMenu = ref(false)

const changeTitleField = () => {
  isOpen.value = false
  changeTitleFieldMenu.value = true
}

const onDeleteColumn = () => {
  eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
}
</script>

<template>
  <NcMenu
    variant="small"
    class="flex flex-col gap-1 border-gray-200 nc-column-options !min-w-55"
    :class="{
      'min-w-[256px]': isExpandedForm,
    }"
  >
    <NcMenuItemCopyId
      v-if="column"
      :id="column.id!"
      data-testid="nc-field-item-action-copy-id"
      :tooltip="$t('msg.clickToCopyFieldId')"
      :label="
        $t('labels.idColon', {
          id: column.id,
        })
      "
    />

    <NcDivider />
    <GeneralSourceRestrictionTooltip
      v-if="isUIAllowed('fieldAlter')"
      message="Field properties cannot be edited."
      :enabled="!isColumnEditAllowed"
    >
      <NcMenuItem
        :disabled="column?.pk || isSystemColumn(column) || !isColumnEditAllowed || linksAssociated?.length"
        :title="linksAssociated?.length ? 'Field is associated with a link column' : undefined"
        @click="onEditPress($event, false)"
      >
        <div class="nc-column-edit nc-header-menu-item">
          <component :is="iconMap.ncEdit" class="opacity-80" />
          <!-- Edit -->
          {{ $t('general.edit') }} {{ $t('objects.field').toLowerCase() }}
        </div>
      </NcMenuItem>
    </GeneralSourceRestrictionTooltip>
    <template v-if="!isExpandedForm">
      <GeneralSourceRestrictionTooltip
        v-if="!column?.pk"
        message="Field cannot be duplicated."
        :enabled="!isDuplicateAllowed && isMetaReadOnly"
      >
        <NcMenuItem :disabled="!isDuplicateAllowed" @click="openDuplicateDlg">
          <div v-e="['a:field:duplicate']" class="nc-column-duplicate nc-header-menu-item">
            <component :is="iconMap.duplicate" class="opacity-80" />
            <!-- Duplicate -->
            {{ t('general.duplicate') }} {{ $t('objects.field').toLowerCase() }}
          </div>
        </NcMenuItem>
      </GeneralSourceRestrictionTooltip>
      <GeneralSourceRestrictionTooltip
        v-if="isUIAllowed('duplicateColumn') && isExpandedForm && !column?.pk"
        message="Field cannot be duplicated."
        :enabled="!isDuplicateAllowed"
      >
        <NcMenuItem :disabled="!isDuplicateAllowed" @click="openDuplicateDlg">
          <div v-e="['a:field:duplicate']" class="nc-column-duplicate nc-header-menu-item">
            <component :is="iconMap.duplicate" class="opacity-80" />
            <!-- Duplicate -->
            {{ t('general.duplicate') }} {{ $t('objects.field').toLowerCase() }}
          </div>
        </NcMenuItem>
      </GeneralSourceRestrictionTooltip>
    </template>

    <NcMenuItem
      v-if="isUIAllowed('fieldAlter') && !!column?.pv"
      title="Select a new field as display value"
      @click="changeTitleField"
    >
      <div class="nc-column-edit nc-header-menu-item">
        <GeneralIcon icon="star" class="opacity-80 !w-4.25 !h-4.25" />
        {{ $t('labels.changeDisplayValueField') }}
      </div>
    </NcMenuItem>
    <NcMenuItem v-if="isUIAllowed('fieldAlter')" title="Add field description" @click="onEditPress($event, true)">
      <div class="nc-column-edit-description nc-header-menu-item">
        <GeneralIcon icon="ncAlignLeft" class="opacity-80 !w-4.25 !h-4.25" />
        {{ $t('labels.editDescription') }}
      </div>
    </NcMenuItem>

    <NcMenuItem v-if="[UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)" @click="openLookupMenuDialog">
      <div v-e="['a:field:lookup:create']" class="nc-column-lookup-create nc-header-menu-item">
        <component :is="iconMap.cellLookup" class="opacity-80 !w-4.5 !h-4.5" />
        {{ t('general.addLookupField') }}
      </div>
    </NcMenuItem>
    <NcDivider v-if="isUIAllowed('fieldAlter') && !column?.pv" />
    <NcMenuItem v-if="!column?.pv" @click="hideOrShowField">
      <div v-e="['a:field:hide']" class="nc-column-insert-before nc-header-menu-item">
        <GeneralLoader v-if="isLoading === 'hideOrShow'" size="regular" />
        <component :is="isHiddenCol ? iconMap.eye : iconMap.eyeSlash" v-else class="!w-4 !h-4 opacity-80" />
        <!-- Hide Field -->
        {{ isHiddenCol ? $t('general.showField') : $t('general.hideField') }}
      </div>
    </NcMenuItem>
    <NcTooltip
      v-if="column && !column?.pv && !isHiddenCol && (!virtual || column.uidt === UITypes.Formula)"
      :disabled="isSupportedDisplayValueColumn(column)"
      placement="right"
    >
      <template #title>
        {{ `${columnTypeName(column)} field cannot be used as display value field` }}
      </template>

      <NcMenuItem :disabled="!isSupportedDisplayValueColumn(column)" @click="setAsDisplayValue">
        <div class="nc-column-set-primary nc-header-menu-item item">
          <GeneralLoader v-if="isLoading === 'setDisplay'" size="regular" />
          <GeneralIcon v-else icon="star" class="opacity-80 !w-4.25 !h-4.25" />

          <!--       todo : tooltip -->
          <!-- Set as Display value -->
          {{ $t('activity.setDisplay') }}
        </div>
      </NcMenuItem>
    </NcTooltip>

    <template v-if="!isExpandedForm">
      <NcDivider v-if="!isLinksOrLTAR(column) || column.colOptions.type !== RelationTypes.BELONGS_TO" />

      <template v-if="!isLinksOrLTAR(column) || column.colOptions.type !== RelationTypes.BELONGS_TO">
        <NcTooltip :disabled="isSortSupported">
          <template #title>
            {{ !isSortSupported ? "This field type doesn't support sorting" : '' }}
          </template>
          <NcMenuItem :disabled="!isSortSupported" @click="sortByColumn('asc')">
            <div v-e="['a:field:sort', { dir: 'asc' }]" class="nc-column-insert-after nc-header-menu-item">
              <component :is="iconMap.sortDesc" class="opacity-80 transform !rotate-180 !w-4.25 !h-4.25" />

              <!-- Sort Ascending -->
              {{ $t('general.sortAsc') }}
            </div>
          </NcMenuItem>
        </NcTooltip>

        <NcTooltip :disabled="isSortSupported">
          <template #title>
            {{ !isSortSupported ? "This field type doesn't support sorting" : '' }}
          </template>
          <NcMenuItem :disabled="!isSortSupported" @click="sortByColumn('desc')">
            <div v-e="['a:field:sort', { dir: 'desc' }]" class="nc-column-insert-before nc-header-menu-item">
              <!-- Sort Descending -->
              <component :is="iconMap.sortDesc" class="opacity-80 !w-4.25 !h-4.25" />
              {{ $t('general.sortDesc').trim() }}
            </div>
          </NcMenuItem>
        </NcTooltip>
      </template>

      <NcDivider />

      <NcTooltip :disabled="isFilterSupported && !isFilterLimitExceeded">
        <template #title>
          {{
            !isFilterSupported
              ? "This field type doesn't support filtering"
              : isFilterLimitExceeded
              ? 'Filter by limit exceeded'
              : ''
          }}
        </template>
        <NcMenuItem
          :disabled="!isFilterSupported || isFilterLimitExceeded"
          @click="filterOrGroupByThisField(SmartsheetStoreEvents.FILTER_ADD)"
        >
          <div v-e="['a:field:add:filter']" class="nc-column-filter nc-header-menu-item">
            <component :is="iconMap.filter" class="opacity-80" />
            <!-- Filter by this field -->
            {{ $t('activity.filterByThisField') }}
          </div>
        </NcMenuItem>
      </NcTooltip>

      <NcTooltip :disabled="(isGroupBySupported && !isGroupByLimitExceeded) || isGroupedByThisField || !(isEeUI && !isPublic)">
        <template #title
          >{{
            !isGroupBySupported
              ? "This field type doesn't support grouping"
              : isGroupByLimitExceeded
              ? 'Group by limit exceeded'
              : ''
          }}
        </template>
        <NcMenuItem
          :disabled="isEeUI && !isPublic && (!isGroupBySupported || isGroupByLimitExceeded) && !isGroupedByThisField"
          @click="
            filterOrGroupByThisField(
              isGroupedByThisField ? SmartsheetStoreEvents.GROUP_BY_REMOVE : SmartsheetStoreEvents.GROUP_BY_ADD,
            )
          "
        >
          <div v-e="['a:field:add:groupby']" class="nc-column-groupby nc-header-menu-item">
            <component :is="iconMap.group" class="opacity-80" />
            <!-- Group by this field -->
            {{ isGroupedByThisField ? "Don't group by this field" : $t('activity.groupByThisField') }}
          </div>
        </NcMenuItem>
      </NcTooltip>

      <NcDivider />
      <NcMenuItem @click="onInsertAfter">
        <div v-e="['a:field:insert:after']" class="nc-column-insert-after nc-header-menu-item">
          <component :is="iconMap.colInsertAfter" class="opacity-80 w-4 h-4" />
          <!-- Insert After -->
          {{ t('general.insertAfter') }}
        </div>
      </NcMenuItem>
      <NcMenuItem v-if="!column?.pv" @click="onInsertBefore">
        <div v-e="['a:field:insert:before']" class="nc-column-insert-before nc-header-menu-item">
          <component :is="iconMap.colInsertBefore" class="opacity-80 w-4 h-4" />
          <!-- Insert Before -->
          {{ t('general.insertBefore') }}
        </div>
      </NcMenuItem>
    </template>
    <NcDivider v-if="!column?.pv" />
    <GeneralSourceRestrictionTooltip
      v-if="!column?.pv && isUIAllowed('fieldDelete')"
      message="Field cannot be deleted."
      :enabled="!isColumnUpdateAllowed"
    >
      <NcMenuItem
        :disabled="!isDeleteAllowed || !isColumnUpdateAllowed || linksAssociated?.length"
        class="!hover:bg-red-50"
        :title="linksAssociated ? 'Field is associated with a link column' : undefined"
        @click="handleDelete"
      >
        <div class="nc-column-delete nc-header-menu-item" :class="{ 'text-red-600': isDeleteAllowed && isColumnUpdateAllowed }">
          <component :is="iconMap.delete" class="opacity-80" />
          <!-- Delete -->
          {{ $t('general.delete') }} {{ $t('objects.field').toLowerCase() }}
        </div>
      </NcMenuItem>
    </GeneralSourceRestrictionTooltip>
    <div class="non-menu-items">
      <SmartsheetHeaderDeleteColumnModal key="dc" v-model:visible="showDeleteColumnModal" :on-delete-column="onDeleteColumn" />
      <DlgColumnDuplicate
        v-if="column"
        key="ddc"
        ref="duplicateDialogRef"
        v-model="isDuplicateDlgOpen"
        :column="column"
        :extra="selectedColumnExtra"
      />
      <LazySmartsheetHeaderAddLookups key="dcx" v-model:value="addLookupMenu" />
      <LazySmartsheetHeaderUpdateDisplayValue
        key="dcxx"
        v-model:value="changeTitleFieldMenu"
        :use-meta-fields="meta?.id !== view?.fk_model_id"
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

.nc-column-options {
  .nc-icons {
    @apply !w-5 !h-5;
  }
}

:deep(.ant-dropdown-menu-item.ant-dropdown-menu-item-disabled .nc-icon) {
  @apply text-current;
}
</style>
