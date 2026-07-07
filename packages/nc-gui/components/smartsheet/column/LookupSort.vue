<script setup lang="ts">
import {
  type ColumnType,
  type SortType,
  type TableType,
  UITypes,
  UITypesName,
  isColumnInError,
  isVirtualCol,
} from 'nocodb-sdk'

// Local, status-tagged sort collection for a Lookup column — the sort analogue of
// how LTAR limit-by-filter works: NOTHING is persisted here. The field editor
// syncs `sorts` into `vModel.value.sorts` and the column save (postColumnAdd /
// postColumnUpdate, scoped by fk_lookup_col_id) persists the whole set. This makes
// sorts configurable BEFORE the column is saved (create flow), not edit-only.
//
// Status tags mirror the link-filter contract:
//   - existing (loaded, unchanged) → no status
//   - newly added                  → 'create'
//   - field/direction changed      → 'update' (only if it has a server id)
//   - removed                      → 'delete' (kept in the set, hidden in UI)
type LookupSort = SortType & { status?: 'create' | 'update' | 'delete' }

const props = defineProps<{
  // The lookup column id (fk_lookup_col_id scope). Empty in the create flow.
  columnId?: string
  // The lookup's target table meta — provides the columns to sort by.
  targetMeta: TableType | undefined
}>()

const { internalGet } = useInternalBatch()
const { base } = storeToRefs(useBase())
const { t } = useI18n()

const wsId = computed(() => base.value?.fk_workspace_id as string)
const baseId = computed(() => base.value?.id as string)

// Full set (incl. delete-tagged) — this is what the parent persists on save.
const sorts = ref<LookupSort[]>([])

// Rows shown in the UI (delete-tagged rows stay in `sorts` for the backend).
const visibleSorts = computed<LookupSort[]>(() => sorts.value.filter((s) => s.status !== 'delete'))

// Non-system target columns, decorated with the same "not sortable" hints the
// toolbar sort menu uses so the shared list renders identical disabled states.
// Virtual columns (formula/rollup/lookup/LTAR, barcode/qr, button) are disabled:
// unlike the display path (sortV2 resolves them), the correlated sub-query the
// filter/formula/view-sort consumers build can only order by real scalar
// columns, so allowing them here would make the limit inconsistent across
// consumers. We shallow-clone each column so the disabled hints don't mutate the
// shared cached meta.
const sortableColumns = computed<ColumnType[]>(() =>
  (props.targetMeta?.columns || [])
    .filter((c: ColumnType) => !c.system)
    .map((c: ColumnType) => {
      const col = { ...c } as ColumnType
      const isDisabled =
        isVirtualCol(col) ||
        [UITypes.QrCode, UITypes.Barcode, UITypes.ID, UITypes.Button].includes(col.uidt) ||
        isColumnInError(col)
      if (isDisabled) {
        col.ncItemDisabled = true
        col.ncItemTooltip = isColumnInError(col)
          ? t('tooltip.sortingNotSupportedForFieldsWithErrors')
          : t('tooltip.sortingNotSupportedForField', { type: UITypesName[col.uidt] })
      }
      return col
    }),
)

// Columns still available to add: enabled (sortable) and not already used by a
// visible sort. Excluding disabled columns is what makes "Add sort" default to a
// real sortable column (e.g. Title) instead of the first column, which is the
// disabled primary-key ID — sorting by ID would just reproduce insertion order.
const availableColumns = computed<ColumnType[]>(() =>
  sortableColumns.value.filter((c) => !c.ncItemDisabled && !visibleSorts.value.some((s) => s.fk_column_id === c.id)),
)

// Edit flow only: hydrate the local set from the persisted lookup sorts.
const loadSorts = async () => {
  if (!props.columnId || !wsId.value || !baseId.value) return
  const list =
    (
      (await internalGet(wsId.value, baseId.value, {
        operation: 'lookupSortList',
        columnId: props.columnId,
      })) as { list: SortType[] }
    )?.list ?? []
  sorts.value = list.map((s) => ({ ...s }))
}

const addSort = () => {
  const next = availableColumns.value[0]
  if (!next) return
  sorts.value = [...sorts.value, { fk_column_id: next.id, direction: 'asc', status: 'create' }]
}

// Field/direction change — the row object is mutated in place by SmartsheetSortList,
// so we only need to (re)tag it. New rows keep 'create'; saved rows become 'update'.
const onSaveOrUpdate = (sort: LookupSort) => {
  if (sort.id && sort.status !== 'create') sort.status = 'update'
}

const onRemove = (sort: LookupSort) => {
  if (sort.id) {
    // Persisted row → keep it tagged for deletion on save.
    sort.status = 'delete'
    sorts.value = [...sorts.value]
  } else {
    // Never-saved row → just drop it.
    sorts.value = sorts.value.filter((s) => s !== sort)
  }
}

onMounted(loadSorts)

// If the lookup's relation/target table changes, the existing sorts reference the
// OLD table's columns and can't apply. Tag persisted ones for deletion (so the
// column save removes them) and drop unsaved ones. Guarded so the async initial
// resolution of targetMeta (undefined → id) doesn't trigger a reset.
watch(
  () => props.targetMeta?.id,
  (newId, oldId) => {
    if (oldId && newId && newId !== oldId) {
      sorts.value = sorts.value.filter((s) => s.id).map((s) => ({ ...s, status: 'delete' as const }))
    }
  },
)

// Exposed to the field editor, which syncs it into vModel.value.sorts.
defineExpose({ sorts })
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="nc-lookup-sort">
    <SmartsheetSortList
      v-if="visibleSorts.length"
      :sorts="visibleSorts"
      :columns="sortableColumns"
      :meta="targetMeta || {}"
      disable-smartsheet
      @save-or-update="onSaveOrUpdate"
      @delete="onRemove"
    />

    <div>
      <NcButton v-if="availableColumns.length" type="text" size="small" data-testid="nc-lookup-sort-add" @click.stop="addSort">
        <div class="flex items-center gap-1">
          <component :is="iconMap.plus" class="w-4 h-4" />
          {{ $t('activity.addSort') }}
        </div>
      </NcButton>
    </div>
  </div>
</template>
