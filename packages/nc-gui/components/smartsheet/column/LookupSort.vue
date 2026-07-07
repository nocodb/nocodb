<script setup lang="ts">
import { type ColumnType, type SortType, type TableType, UITypes, UITypesName, isColumnInError } from 'nocodb-sdk'

// Thin, lookup-scoped data container for sorts — the lookup-editor analogue of
// `useViewSorts`/`SortListMenu`. It owns persistence only; the UI is the shared,
// presentational <SmartsheetSortList> (the same component the toolbar sort menu
// uses). Sorts are scoped to the lookup column via `fk_lookup_col_id` and saved
// through the internal lookupSort* operations; the PG read path applies them with
// sortV2. Edit-mode only (needs a saved column id).
const props = defineProps<{
  // The lookup column id (fk_lookup_col_id scope).
  columnId: string
  // The lookup's target table meta — provides the columns to sort by.
  targetMeta: TableType | undefined
}>()

const { $api } = useNuxtApp()
const { internalGet } = useInternalBatch()
const { base } = storeToRefs(useBase())
const { t } = useI18n()

const wsId = computed(() => base.value?.fk_workspace_id as string)
const baseId = computed(() => base.value?.id as string)

const sorts = ref<SortType[]>([])

// Non-system target columns, decorated with the same "not sortable" hints the
// toolbar sort menu uses so the shared list renders identical disabled states.
const sortableColumns = computed<ColumnType[]>(() =>
  (props.targetMeta?.columns || [])
    .filter((c: ColumnType) => !c.system)
    .map((c: ColumnType) => {
      const isDisabled = [UITypes.QrCode, UITypes.Barcode, UITypes.ID, UITypes.Button].includes(c.uidt) || isColumnInError(c)
      if (isDisabled) {
        c.ncItemDisabled = true
        c.ncItemTooltip = isColumnInError(c)
          ? t('tooltip.sortingNotSupportedForFieldsWithErrors')
          : t('tooltip.sortingNotSupportedForField', { type: UITypesName[c.uidt] })
      }
      return c
    }),
)

// Columns still available to add (not already sorted).
const availableColumns = computed<ColumnType[]>(() =>
  sortableColumns.value.filter((c) => !sorts.value.some((s) => s.fk_column_id === c.id)),
)

const loadSorts = async () => {
  if (!props.columnId || !wsId.value || !baseId.value) return
  sorts.value =
    (
      (await internalGet(wsId.value, baseId.value, {
        operation: 'lookupSortList',
        columnId: props.columnId,
      })) as { list: SortType[] }
    )?.list ?? []
}

const addSort = async () => {
  const next = availableColumns.value[0]
  if (!next) return
  const created = (await $api.internal.postOperation(
    wsId.value,
    baseId.value,
    { operation: 'lookupSortCreate', columnId: props.columnId },
    { fk_column_id: next.id, direction: 'asc' },
  )) as unknown as SortType
  sorts.value = [...sorts.value, created]
}

// Field/direction edits: rows always carry an id here (created server-side), so
// this is always an update via the shared sortUpdate operation.
const saveOrUpdate = async (sort: SortType) => {
  if (!sort.id) return
  await $api.internal.postOperation(
    wsId.value,
    baseId.value,
    { operation: 'sortUpdate', sortId: sort.id },
    { fk_column_id: sort.fk_column_id, direction: sort.direction },
  )
}

const removeSort = async (sort: SortType) => {
  sorts.value = sorts.value.filter((s) => s !== sort)
  if (sort?.id) {
    await $api.internal.postOperation(wsId.value, baseId.value, { operation: 'sortDelete', sortId: sort.id }, {})
  }
}

onMounted(loadSorts)
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="nc-lookup-sort">
    <SmartsheetSortList
      v-if="sorts.length"
      :sorts="sorts"
      :columns="sortableColumns"
      :meta="targetMeta || {}"
      disable-smartsheet
      @save-or-update="saveOrUpdate"
      @delete="removeSort"
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
