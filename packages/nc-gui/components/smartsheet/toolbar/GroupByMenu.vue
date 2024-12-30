<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import Draggable from 'vuedraggable'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { gridViewCols, updateGridViewColumn, metaColumnById, showSystemFields } = useViewColumnsOrThrow()

const { fieldsToGroupBy, groupByLimit } = useViewGroupByOrThrow()

const { $e } = useNuxtApp()

interface Group {
  fk_column_id?: string
  sort: string
  order: number
}

const _groupBy = ref<Group[]>([])

const groupBy = computed<Group[]>(() => {
  const tempGroupBy: Group[] = []
  Object.values(gridViewCols.value).forEach((col) => {
    if (col.group_by) {
      tempGroupBy.push({
        fk_column_id: col.fk_column_id,
        sort: col.group_by_sort || 'asc',
        order: col.group_by_order || 1,
      })
    }
  })
  tempGroupBy.sort((a, b) => a.order - b.order)
  return tempGroupBy
})

const groupedByColumnIds = computed(() => groupBy.value.map((g) => g.fk_column_id).filter((g) => g))

const { eventBus } = useSmartsheetStoreOrThrow()

const { isMobileMode } = useGlobal()

const showCreateGroupBy = ref(false)

const columns = computed(() => meta.value?.columns || [])

const columnByID = computed(() =>
  columns.value.reduce((obj, col) => {
    obj[col.id!] = col

    return obj
  }, {} as Record<string, ColumnType>),
)

const availableColumns = computed(() => {
  return columns.value
    ?.filter((c: ColumnType) => {
      if (c.uidt === UITypes.Links) {
        return true
      }
      if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
        return (
          /** hide system columns if not enabled */
          showSystemFields.value
        )
      } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID) {
        return false
      } else {
        /** ignore hasmany and manytomany relations if it's using within sort menu */
        return !(isLinksOrLTAR(c) && (c.colOptions as LinkToAnotherRecordType).type !== RelationTypes.BELONGS_TO)
        /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
      }
    })
    .filter((c) => !groupBy.value.find((g) => g.fk_column_id === c.id))
})

const getColumnUidtByID = (key?: string) => {
  if (!key) return ''
  return columnByID.value[key]?.uidt || ''
}

const open = ref(false)

useMenuCloseOnEsc(open)

const saveGroupBy = async () => {
  if (view.value?.id) {
    try {
      for (const gby of _groupBy.value) {
        if (!gby.fk_column_id) continue
        const col = gridViewCols.value[gby.fk_column_id]
        if (col && (!col.group_by || col.group_by_order !== gby.order || col.group_by_sort !== gby.sort)) {
          await updateGridViewColumn(gby.fk_column_id, {
            group_by: true,
            group_by_order: gby.order,
            group_by_sort: gby.sort,
          })
        }
      }

      for (const gby of groupBy.value) {
        if (!gby.fk_column_id) continue
        if (_groupBy.value.find((g) => g.fk_column_id === gby.fk_column_id)) continue
        const col = gridViewCols.value[gby.fk_column_id]
        if (col && col.group_by) {
          await updateGridViewColumn(gby.fk_column_id, {
            group_by: false,
            group_by_order: undefined,
            group_by_sort: undefined,
          })
        }
      }

      $e('a:group-by:update', { groupBy: groupBy.value })

      eventBus.emit(SmartsheetStoreEvents.GROUP_BY_RELOAD)
    } catch (e) {
      message.error('There was an error while updating view!')
    }
  } else {
    message.error('View not found!!!')
  }
}

const addFieldToGroupBy = (column: ColumnType) => {
  _groupBy.value.push({ fk_column_id: column.id, sort: 'asc', order: _groupBy.value.length + 1 })
  saveGroupBy()
  showCreateGroupBy.value = false
}

const removeFieldFromGroupBy = async (group: Group) => {
  if (groupedByColumnIds.value.length === 0) {
    open.value = false
    return
  }

  const index = _groupBy.value.findIndex((g) => g.fk_column_id === group.fk_column_id)
  _groupBy.value.splice(+index, 1)
  await saveGroupBy()
}

watch(open, () => {
  if (open.value) {
    _groupBy.value = [...groupBy.value]
  } else {
    showCreateGroupBy.value = false
  }
})

eventBus.on(async (event, column) => {
  if (!column?.id) return

  if (event === SmartsheetStoreEvents.GROUP_BY_ADD) {
    addFieldToGroupBy(column)
  } else if (event === SmartsheetStoreEvents.GROUP_BY_REMOVE) {
    if (groupedByColumnIds.value.length === 0) return

    _groupBy.value = _groupBy.value.filter((g) => g.fk_column_id !== column.id)

    await saveGroupBy()
  }
})

const onMove = async (event: { moved: { newIndex: number; oldIndex: number } }) => {
  const { newIndex, oldIndex } = event.moved

  const tempGroups = [..._groupBy.value]

  const movedItem = tempGroups.splice(oldIndex, 1)[0]

  tempGroups.splice(newIndex, 0, movedItem ?? [])

  const updatedGroups = tempGroups.map((group, index) => ({ ...group, order: index + 1 }))

  _groupBy.value = [...updatedGroups]

  await saveGroupBy()
}
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    offset-y
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="nc-dropdown-group-by-menu nc-toolbar-dropdown overflow-hidden"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode" :class="{ 'nc-active-btn': groupedByColumnIds?.length }">
      <template #title>
        {{ $t('activity.group') }}
      </template>
      <NcButton
        v-e="['c:group-by']"
        class="nc-group-by-menu-btn nc-toolbar-btn !border-0 !h-7"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.group" class="h-4 w-4" />

            <!-- Group By -->
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">{{
              $t('activity.group')
            }}</span>
          </div>
          <span v-if="groupedByColumnIds?.length" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">{{
            groupedByColumnIds.length
          }}</span>
        </div>
      </NcButton>
    </NcTooltip>
    <template #overlay>
      <div
        :class="{
          'nc-locked-view': isLocked,
        }"
      >
        <SmartsheetToolbarCreateGroupBy
          v-if="!_groupBy.length"
          :is-parent-open="open"
          :columns="fieldsToGroupBy"
          :disabled="isLocked"
          @created="addFieldToGroupBy"
        />
        <div
          v-else
          class="flex flex-col bg-white overflow-auto nc-group-by-list menu-filter-dropdown w-100 p-4"
          data-testid="nc-group-by-menu"
        >
          <div class="max-h-100" @click.stop>
            <Draggable
              :model-value="_groupBy"
              item-key="fk_column_id"
              ghost-class="bg-gray-50"
              :disabled="isLocked"
              @change="onMove($event)"
            >
              <template #item="{ element: group }">
                <div :key="group.fk_column_id" class="flex first:mb-0 !mb-1.5 !last:mb-0 items-center">
                  <NcButton
                    type="secondary"
                    size="small"
                    class="!border-r-transparent !rounded-r-none"
                    :shadow="false"
                    :disabled="isLocked"
                  >
                    <component :is="iconMap.drag" />
                  </NcButton>
                  <LazySmartsheetToolbarFieldListAutoCompleteDropdown
                    v-model="group.fk_column_id"
                    class="caption nc-sort-field-select !w-36"
                    :columns="fieldsToGroupBy"
                    :allow-empty="true"
                    :meta="meta"
                    :disabled="isLocked"
                    @change="saveGroupBy"
                    @click.stop
                  />
                  <NcSelect
                    ref=""
                    v-model:value="group.sort"
                    class="flex flex-grow-1 w-full nc-sort-dir-select"
                    :label="$t('labels.operation')"
                    dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir"
                    :disabled="!group.fk_column_id || isLocked"
                    @change="saveGroupBy"
                    @click.stop
                  >
                    <a-select-option
                      v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(group.fk_column_id), true)"
                      :key="j"
                      :value="option.value"
                    >
                      <div class="w-full flex items-center justify-between gap-2">
                        <div class="truncate flex-1">{{ option.text }}</div>
                        <component
                          :is="iconMap.check"
                          v-if="group.sort === option.value"
                          id="nc-selected-item-icon"
                          class="text-primary w-4 h-4"
                        />
                      </div>
                    </a-select-option>
                  </NcSelect>

                  <!--                <NcDropdown :disabled="!isColumnSupportsGroupBySettings(columnByID[group.fk_column_id])" :trigger="['click']">
                  <NcButton
                    :disabled="!isColumnSupportsGroupBySettings(columnByID[group.fk_column_id])"
                    class="!rounded-none !border-gray-200 !border-l-transparent"
                    type="secondary"
                    size="small"
                  >
                    <GeneralIcon icon="ncSettings" />
                  </NcButton>

                  <template #overlay>
                    <NcMenu>
                      <NcMenuItem> Hide groups with no records </NcMenuItem>
                      <NcMenuItem> Show groups with no records </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown> -->

                  <NcTooltip placement="top" title="Remove" class="flex-none">
                    <NcButton
                      v-e="['c:group-by:remove']"
                      class="nc-group-by-item-remove-btn !border-l-transparent !rounded-l-none"
                      size="small"
                      type="secondary"
                      :shadow="false"
                      :disabled="isLocked"
                      @click.stop="removeFieldFromGroupBy(group)"
                    >
                      <component :is="iconMap.deleteListItem" />
                    </NcButton>
                  </NcTooltip>
                </div>
              </template>
            </Draggable>
          </div>
          <NcDropdown
            v-if="availableColumns.length && fieldsToGroupBy.length > _groupBy.length && _groupBy.length < groupByLimit"
            v-model:visible="showCreateGroupBy"
            :trigger="['click']"
            overlay-class-name="nc-toolbar-dropdown"
            :disabled="isLocked"
          >
            <NcButton
              v-e="['c:group-by:add']"
              type="text"
              size="small"
              style="width: fit-content"
              class="nc-add-group-by-btn mt-2"
              :class="{
                '!text-brand-500': !isLocked,
              }"
              :disabled="isLocked"
              @click.stop="showCreateGroupBy = true"
            >
              <div class="flex gap-1 items-center">
                <GeneralIcon icon="plus" />
                {{ $t('activity.addSubGroup') }}
              </div>
            </NcButton>
            <template #overlay>
              <SmartsheetToolbarCreateGroupBy
                :is-parent-open="showCreateGroupBy"
                :columns="fieldsToGroupBy"
                @created="addFieldToGroupBy"
              />
            </template>
          </NcDropdown>
        </div>
        <GeneralLockedViewFooter
          v-if="isLocked"
          :class="{
            '-mt-2': _groupBy.length,
          }"
          @on-open="open = false"
        />
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
:deep(.nc-sort-field-select) {
  @apply !w-36;
  .ant-select-selector {
    @apply !rounded-none !border-r-0 !border-gray-200 !shadow-none !w-36;

    &.ant-select-focused:not(.ant-select-disabled) {
      @apply !border-r-transparent;
    }
  }
}

:deep(.nc-select:not(.ant-select-disabled):hover) {
  &,
  .ant-select-selector {
    @apply bg-gray-50;
  }
}

:deep(.nc-sort-dir-select) {
  .ant-select-selector {
    @apply !rounded-none !border-gray-200 !shadow-none;
  }
}
</style>
