<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType, LookupType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsLockedInj,
  MetaInj,
  computed,
  getSortDirectionOptions,
  inject,
  onMounted,
  ref,
  useMenuCloseOnEsc,
  useMetas,
  useNuxtApp,
  useSmartsheetStoreOrThrow,
  useViewColumnsOrThrow,
  watch,
} from '#imports'

const excludedGroupingUidt = [UITypes.Attachment]

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const isLocked = inject(IsLockedInj, ref(false))

const { gridViewCols, updateGridViewColumn, metaColumnById, showSystemFields } = useViewColumnsOrThrow()

const { $e } = useNuxtApp()

const _groupBy = ref<{ fk_column_id?: string; sort: string; order: number }[]>([])

const { getMeta } = useMetas()

const groupBy = computed<{ fk_column_id?: string; sort: string; order: number }[]>(() => {
  const tempGroupBy: { fk_column_id?: string; sort: string; order: number }[] = []
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

const supportedLookups = ref<string[]>([])

const showCreateGroupBy = ref(false)

const fieldsToGroupBy = computed(() => {
  const fields = meta.value?.columns || []

  return fields.filter((field) => {
    if (excludedGroupingUidt.includes(field.uidt as UITypes)) return false

    if (field.uidt === UITypes.Lookup) {
      return field.id && supportedLookups.value.includes(field.id)
    }

    return true
  })
})

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

const removeFieldFromGroupBy = async (index: string | number) => {
  if (groupedByColumnIds.value.length === 0) {
    open.value = false
    return
  }
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

const loadAllowedLookups = async () => {
  const filteredLookupCols = []
  try {
    for (const col of meta.value?.columns || []) {
      if (col.uidt !== UITypes.Lookup) continue

      let nextCol: ColumnType = col
      // check the lookup column is supported type or not
      while (nextCol && nextCol.uidt === UITypes.Lookup) {
        const lookupRelation = (await getMeta(nextCol.fk_model_id as string))?.columns?.find(
          (c) => c.id === (nextCol?.colOptions as LookupType).fk_relation_column_id,
        )

        const relatedTableMeta = await getMeta(
          (lookupRelation?.colOptions as LinkToAnotherRecordType).fk_related_model_id as string,
        )

        nextCol = relatedTableMeta?.columns?.find(
          (c) => c.id === ((nextCol?.colOptions as LookupType).fk_lookup_column_id as string),
        ) as ColumnType

        // if next column is same as root lookup column then break the loop
        // since it's going to be a circular loop, and ignore the column
        if (nextCol?.id === col.id) {
          break
        }
      }

      if (nextCol?.uidt !== UITypes.Attachment && col.id) filteredLookupCols.push(col.id)
    }

    supportedLookups.value = filteredLookupCols
  } catch (e) {
    console.error(e)
  }
}

onMounted(async () => {
  await loadAllowedLookups()
})

watch(meta, async () => {
  await loadAllowedLookups()
})
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    offset-y
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="nc-dropdown-group-by-menu nc-toolbar-dropdown overflow-hidden"
  >
    <div :class="{ 'nc-active-btn': groupedByColumnIds?.length }">
      <a-button v-e="['c:group-by']" class="nc-group-by-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-2">
          <component :is="iconMap.group" class="h-4 w-4" />

          <!-- Group By -->
          <span v-if="!isMobileMode" class="text-capitalize !text-sm font-medium">{{ $t('activity.groupBy') }}</span>

          <span v-if="groupedByColumnIds?.length" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">{{
            groupedByColumnIds.length
          }}</span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <SmartsheetToolbarCreateGroupBy
        v-if="!_groupBy.length"
        :is-parent-open="open"
        :columns="fieldsToGroupBy"
        @created="addFieldToGroupBy"
      />
      <div
        v-else
        :class="{ ' min-w-[400px]': _groupBy.length }"
        class="flex flex-col bg-white overflow-auto nc-group-by-list menu-filter-dropdown max-h-[max(80vh,500px)] py-6 pl-6"
        data-testid="nc-group-by-menu"
      >
        <div
          class="group-by-grid pb-1 max-h-100 nc-scrollbar-md pr-5"
          :class="{ 'mb-2': availableColumns.length && fieldsToGroupBy.length > _groupBy.length && _groupBy.length < 3 }"
          @click.stop
        >
          <template v-for="[i, group] of Object.entries(_groupBy)" :key="`grouped-by-${group.fk_column_id}`">
            <LazySmartsheetToolbarFieldListAutoCompleteDropdown
              v-model="group.fk_column_id"
              class="caption nc-sort-field-select"
              :columns="fieldsToGroupBy"
              :allow-empty="true"
              @change="saveGroupBy"
              @click.stop
            />
            <NcSelect
              ref=""
              v-model:value="group.sort"
              class="shrink grow-0 nc-sort-dir-select"
              :label="$t('labels.operation')"
              dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir"
              :disabled="!group.fk_column_id"
              @change="saveGroupBy"
              @click.stop
            >
              <a-select-option
                v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(group.fk_column_id))"
                :key="j"
                :value="option.value"
              >
                <div class="flex items-center justify-between gap-2">
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

            <a-tooltip placement="right" title="Remove">
              <NcButton
                v-e="['c:group-by:remove']"
                class="nc-group-by-item-remove-btn"
                size="small"
                type="text"
                @click.stop="removeFieldFromGroupBy(i)"
              >
                <component :is="iconMap.deleteListItem" />
              </NcButton>
            </a-tooltip>
          </template>
        </div>
        <NcDropdown
          v-if="availableColumns.length && fieldsToGroupBy.length > _groupBy.length && _groupBy.length < 3"
          v-model:visible="showCreateGroupBy"
          :trigger="['click']"
          overlay-class-name="nc-toolbar-dropdown"
        >
          <NcButton
            v-e="['c:group-by:add']"
            class="nc-add-group-by-btn !text-brand-500"
            style="width: fit-content"
            size="small"
            type="text"
            @click.stop="showCreateGroupBy = true"
          >
            <div class="flex gap-1 items-center">
              <div class="flex">
                {{ $t('activity.addSubGroup') }}
              </div>
              <GeneralIcon icon="plus" />
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
    </template>
  </NcDropdown>
</template>

<style scoped>
.group-by-grid {
  display: grid;
  grid-template-columns: auto 150px 22px;
  @apply gap-[12px];
}
</style>
