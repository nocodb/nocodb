<script lang="ts" setup>
import { type ColumnReqType, type ColumnType, partialUpdateAllowedTypes, readonlyMetaAllowedTypes } from 'nocodb-sdk'
import { PlanLimitTypes, RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import { SmartsheetStoreEvents, isColumnInvalid } from '#imports'

const props = defineProps<{ virtual?: boolean; isOpen: boolean; isHiddenCol?: boolean }>()

const emit = defineEmits(['edit', 'addColumn', 'update:isOpen'])

const virtual = toRef(props, 'virtual')

const isOpen = useVModel(props, 'isOpen', emit)

const { eventBus, allFilters } = useSmartsheetStoreOrThrow()

const column = inject(ColumnInj)

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj)

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

    // Successfully updated as primary column
    // message.success(t('msg.success.primaryColumnUpdated'))

    $e('a:column:set-primary')

    addUndo({
      redo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

          // Successfully updated as primary column
          // message.success(t('msg.success.primaryColumnUpdated'))
        },
        args: [column?.value?.id as string],
      },
      undo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

          // Successfully updated as primary column
          // message.success(t('msg.success.primaryColumnUpdated'))
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

// hide the field in view
const hideOrShowField = async () => {
  isLoading.value = 'hideOrShow'
  const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

  const currentColumn = gridViewColumnList.find((f) => f.fk_column_id === column!.value.id)

  const promises = [$api.dbViewColumn.update(view.value!.id!, currentColumn!.id!, { show: !currentColumn.show })]

  if (isExpandedForm.value) {
    promises.push(getMeta(meta?.value?.id as string, true))
  }

  await Promise.all(promises)

  eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
  if (!currentColumn.show) {
    reloadDataHook?.trigger()
  }

  addUndo({
    redo: {
      fn: async function redo(id: string, show: boolean) {
        const promises = [$api.dbViewColumn.update(view.value!.id!, id, { show: !show })]

        if (isExpandedForm.value) {
          promises.push(getMeta(meta?.value?.id as string, true))
        }

        await Promise.all(promises)

        eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
        if (!show) {
          reloadDataHook?.trigger()
        }
      },
      args: [currentColumn!.id, currentColumn.show],
    },
    undo: {
      fn: async function undo(id: string, show: boolean) {
        const promises = [$api.dbViewColumn.update(view.value!.id!, id, { show })]

        if (isExpandedForm.value) {
          promises.push(getMeta(meta?.value?.id as string, true))
        }

        await Promise.all(promises)

        eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
        reloadDataHook?.trigger()
        if (show) {
          reloadDataHook?.trigger()
        }
      },
      args: [currentColumn!.id, currentColumn.show],
    },
    scope: defineViewScope({ view: view.value }),
  })

  isLoading.value = ''
}

const handleDelete = () => {
  // closing the dropdown
  // when modal opens
  isOpen.value = false
  showDeleteColumnModal.value = true
}

const onEditPress = (event?: MouseEvent, enableDescription = false) => {
  isOpen.value = false
  emit('edit', event, enableDescription)
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
  return column?.value && !column.value.system
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

const openDropdown = () => {
  if (isLocked) return
  isOpen.value = !isOpen.value
}

const isFieldIdCopied = ref(false)

const { copy } = useClipboard()

const onClickCopyFieldUrl = async (field: ColumnType) => {
  await copy(field.id!)

  isFieldIdCopied.value = true
}
</script>

<template>
  <a-dropdown
    v-model:visible="isOpen"
    :disabled="isLocked"
    :trigger="['click']"
    :placement="isExpandedForm ? 'bottomLeft' : 'bottomRight'"
    overlay-class-name="nc-dropdown-column-operations !border-1 rounded-lg !shadow-xl "
    @click.stop="openDropdown"
  >
    <div class="flex gap-0.5 items-center" @dblclick.stop>
      <div v-if="isExpandedForm" class="h-[1px]">&nbsp;</div>
      <NcTooltip v-if="column?.description?.length && !isExpandedForm" class="flex">
        <template #title>
          {{ column?.description }}
        </template>
        <GeneralIcon icon="info" class="group-hover:opacity-100 !w-3.5 !h-3.5 !text-gray-500 flex-none" />
      </NcTooltip>

      <NcTooltip class="flex items-center">
        <GeneralIcon
          v-if="isColumnInvalid(column) && !isExpandedForm"
          class="text-orange-500 w-3.5 h-3.5 ml-2"
          icon="alertTriangle"
        />

        <template #title>
          {{ $t('msg.invalidColumnConfiguration') }}
        </template>
      </NcTooltip>
      <GeneralIcon
        v-if="!isExpandedForm && !isLocked"
        icon="arrowDown"
        class="text-grey h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0 mr-2"
      />
    </div>
    <template #overlay>
      <NcMenu
        class="flex flex-col gap-1 border-gray-200 nc-column-options"
        :class="{
          'min-w-[256px]': isExpandedForm,
        }"
      >
        <NcTooltip
          :attrs="{
            class: 'w-full',
          }"
          placement="top"
        >
          <template #title>{{ $t('msg.clickToCopyFieldId') }}</template>

          <div
            class="nc-copy-field flex flex-row justify-between items-center w-[calc(100%_-_12px)] p-2 mx-1.5 rounded-md hover:bg-gray-100 cursor-pointer group"
            data-testid="nc-field-item-action-copy-id"
            @click.stop="onClickCopyFieldUrl(column)"
          >
            <div class="w-full flex flex-row justify-between items-center gap-x-2 font-bold text-xs">
              <div class="flex flex-row text-gray-500 text-xs items-baseline gap-x-1 font-bold">
                {{
                  $t('labels.idColon', {
                    id: column.id,
                  })
                }}
              </div>
              <NcButton size="xsmall" type="secondary" class="!group-hover:bg-gray-100">
                <GeneralIcon v-if="isFieldIdCopied" icon="check" class="h-4 w-4" />
                <GeneralIcon v-else icon="copy" class="h-4 w-4" />
              </NcButton>
            </div>
          </div>
        </NcTooltip>

        <a-divider class="!my-0" />
        <GeneralSourceRestrictionTooltip message="Field properties cannot be edited." :enabled="!isColumnEditAllowed">
          <NcMenuItem
            v-if="isUIAllowed('fieldAlter')"
            :disabled="column?.pk || isSystemColumn(column) || !isColumnEditAllowed || linksAssociated.length"
            :title="linksAssociated.length ? 'Field is associated with a link column' : undefined"
            @click="onEditPress($event, false)"
          >
            <div class="nc-column-edit nc-header-menu-item">
              <component :is="iconMap.ncEdit" class="text-gray-500" />
              <!-- Edit -->
              {{ $t('general.edit') }} {{ $t('objects.field').toLowerCase() }}
            </div>
          </NcMenuItem>
        </GeneralSourceRestrictionTooltip>
        <template v-if="!isExpandedForm">
          <GeneralSourceRestrictionTooltip message="Field cannot be duplicated." :enabled="!isDuplicateAllowed && isMetaReadOnly">
            <NcMenuItem v-if="!column?.pk" :disabled="!isDuplicateAllowed" @click="openDuplicateDlg">
              <div v-e="['a:field:duplicate']" class="nc-column-duplicate nc-header-menu-item">
                <component :is="iconMap.duplicate" class="text-gray-500" />
                <!-- Duplicate -->
                {{ t('general.duplicate') }} {{ $t('objects.field').toLowerCase() }}
              </div>
            </NcMenuItem>
          </GeneralSourceRestrictionTooltip>
          <GeneralSourceRestrictionTooltip message="Field cannot be duplicated." :enabled="!isDuplicateAllowed">
            <NcMenuItem
              v-if="isUIAllowed('duplicateColumn') && isExpandedForm && !column?.pk"
              :disabled="!isDuplicateAllowed"
              @click="openDuplicateDlg"
            >
              <div v-e="['a:field:duplicate']" class="nc-column-duplicate nc-header-menu-item">
                <component :is="iconMap.duplicate" class="text-gray-500" />
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
            <GeneralIcon icon="star" class="text-gray-500 !w-4.25 !h-4.25" />
            {{ $t('labels.changeDisplayValueField') }}
          </div>
        </NcMenuItem>
        <NcMenuItem v-if="isUIAllowed('fieldAlter')" title="Add field description" @click="onEditPress($event, true)">
          <div class="nc-column-edit-description nc-header-menu-item">
            <GeneralIcon icon="ncAlignLeft" class="text-gray-500 !w-4.25 !h-4.25" />
            {{ $t('labels.editDescription') }}
          </div>
        </NcMenuItem>

        <NcMenuItem v-if="[UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)" @click="openLookupMenuDialog">
          <div v-e="['a:field:lookup:create']" class="nc-column-lookup-create nc-header-menu-item">
            <component :is="iconMap.cellLookup" class="text-gray-500 !w-4.5 !h-4.5" />
            {{ t('general.addLookupField') }}
          </div>
        </NcMenuItem>
        <a-divider v-if="isUIAllowed('fieldAlter') && !column?.pv" class="!my-0" />
        <NcMenuItem v-if="!column?.pv" @click="hideOrShowField">
          <div v-e="['a:field:hide']" class="nc-column-insert-before nc-header-menu-item">
            <GeneralLoader v-if="isLoading === 'hideOrShow'" size="regular" />
            <component :is="isHiddenCol ? iconMap.eye : iconMap.eyeSlash" v-else class="text-gray-500 !w-4 !h-4" />
            <!-- Hide Field -->
            {{ isHiddenCol ? $t('general.showField') : $t('general.hideField') }}
          </div>
        </NcMenuItem>
        <NcMenuItem
          v-if="(!virtual || column?.uidt === UITypes.Formula) && !column?.pv && !isHiddenCol"
          @click="setAsDisplayValue"
        >
          <div class="nc-column-set-primary nc-header-menu-item item">
            <GeneralLoader v-if="isLoading === 'setDisplay'" size="regular" />
            <GeneralIcon v-else icon="star" class="text-gray-500 !w-4.25 !h-4.25" />

            <!--       todo : tooltip -->
            <!-- Set as Display value -->
            {{ $t('activity.setDisplay') }}
          </div>
        </NcMenuItem>

        <template v-if="!isExpandedForm">
          <a-divider v-if="!isLinksOrLTAR(column) || column.colOptions.type !== RelationTypes.BELONGS_TO" class="!my-0" />

          <template v-if="!isLinksOrLTAR(column) || column.colOptions.type !== RelationTypes.BELONGS_TO">
            <NcTooltip :disabled="isSortSupported">
              <template #title>
                {{ !isSortSupported ? "This field type doesn't support sorting" : '' }}
              </template>
              <NcMenuItem :disabled="!isSortSupported" @click="sortByColumn('asc')">
                <div v-e="['a:field:sort', { dir: 'asc' }]" class="nc-column-insert-after nc-header-menu-item">
                  <component :is="iconMap.sortDesc" class="text-gray-500 transform !rotate-180 !w-4.25 !h-4.25" />

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
                  <component :is="iconMap.sortDesc" class="text-gray-500 !w-4.25 !h-4.25" />
                  {{ $t('general.sortDesc').trim() }}
                </div>
              </NcMenuItem>
            </NcTooltip>
          </template>

          <a-divider class="!my-0" />

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
                <component :is="iconMap.filter" class="text-gray-500" />
                <!-- Filter by this field -->
                Filter by this field
              </div>
            </NcMenuItem>
          </NcTooltip>

          <NcTooltip
            :disabled="(isGroupBySupported && !isGroupByLimitExceeded) || isGroupedByThisField || !(isEeUI && !isPublic)"
          >
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
                <component :is="iconMap.group" class="text-gray-500" />
                <!-- Group by this field -->
                {{ isGroupedByThisField ? "Don't group by this field" : 'Group by this field' }}
              </div>
            </NcMenuItem>
          </NcTooltip>

          <a-divider class="!my-0" />
          <NcMenuItem @click="onInsertAfter">
            <div v-e="['a:field:insert:after']" class="nc-column-insert-after nc-header-menu-item">
              <component :is="iconMap.colInsertAfter" class="text-gray-500 !w-4.5 !h-4.5" />
              <!-- Insert After -->
              {{ t('general.insertAfter') }}
            </div>
          </NcMenuItem>
          <NcMenuItem v-if="!column?.pv" @click="onInsertBefore">
            <div v-e="['a:field:insert:before']" class="nc-column-insert-before nc-header-menu-item">
              <component :is="iconMap.colInsertBefore" class="text-gray-500 !w-4.5 !h-4.5" />
              <!-- Insert Before -->
              {{ t('general.insertBefore') }}
            </div>
          </NcMenuItem>
        </template>
        <a-divider v-if="!column?.pv" class="!my-0" />
        <GeneralSourceRestrictionTooltip message="Field cannot be deleted." :enabled="!isColumnUpdateAllowed">
          <NcMenuItem
            v-if="!column?.pv && isUIAllowed('fieldDelete')"
            :disabled="!isDeleteAllowed || !isColumnUpdateAllowed || linksAssociated.length"
            class="!hover:bg-red-50"
            :title="linksAssociated ? 'Field is associated with a link column' : undefined"
            @click="handleDelete"
          >
            <div
              class="nc-column-delete nc-header-menu-item"
              :class="{ ' text-red-600': isDeleteAllowed && isColumnUpdateAllowed }"
            >
              <component :is="iconMap.delete" />
              <!-- Delete -->
              {{ $t('general.delete') }} {{ $t('objects.field').toLowerCase() }}
            </div>
          </NcMenuItem>
        </GeneralSourceRestrictionTooltip>
      </NcMenu>
    </template>
  </a-dropdown>
  <SmartsheetHeaderDeleteColumnModal v-model:visible="showDeleteColumnModal" />
  <DlgColumnDuplicate
    v-if="column"
    ref="duplicateDialogRef"
    v-model="isDuplicateDlgOpen"
    :column="column"
    :extra="selectedColumnExtra"
  />

  <LazySmartsheetHeaderAddLookups v-if="addLookupMenu" v-model:value="addLookupMenu" :column="column" />
  <LazySmartsheetHeaderUpdateDisplayValue v-if="changeTitleFieldMenu" v-model:value="changeTitleFieldMenu" :column="column" />
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply !w-full;
}
.nc-header-menu-item {
  @apply text-dropdown flex items-center gap-2;
}

.nc-column-options {
  .nc-icons {
    @apply !w-5 !h-5;
  }
}

:deep(.ant-dropdown-menu-item:not(.ant-dropdown-menu-item-disabled)) {
  @apply !hover:text-black text-gray-700;
}

:deep(.ant-dropdown-menu-item.ant-dropdown-menu-item-disabled .nc-icon) {
  @apply text-current;
}
</style>
