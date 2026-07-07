<script setup lang="ts">
import type { ColumnType, SortType, TableType } from 'nocodb-sdk'

// Small, reusable sort builder for a Lookup column (NOT the heavy filter
// component). Sorts are scoped to the lookup column (fk_lookup_col_id) and
// persisted to the Sort table via the internal lookupSort* operations — the
// PG read path applies them with sortV2. Edit-mode only (needs a saved column).
const props = defineProps<{
  // The lookup column id (fk_lookup_col_id scope).
  columnId: string
  // The lookup's target table meta — provides the columns to sort by.
  targetMeta: TableType | undefined
}>()

const { $api } = useNuxtApp()
const { internalGet } = useInternalBatch()
const { base } = storeToRefs(useBase())

const wsId = computed(() => base.value?.fk_workspace_id as string)
const baseId = computed(() => base.value?.id as string)

const sorts = ref<SortType[]>([])

// Any non-system column of the target table is a valid sort key (Airtable parity).
const sortableColumns = computed<ColumnType[]>(() => (props.targetMeta?.columns || []).filter((c: ColumnType) => !c.system))

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
  const used = new Set(sorts.value.map((s) => s.fk_column_id))
  const next = sortableColumns.value.find((c) => !used.has(c.id!)) || sortableColumns.value[0]
  if (!next) return
  const created = (await $api.internal.postOperation(
    wsId.value,
    baseId.value,
    { operation: 'lookupSortCreate', columnId: props.columnId },
    { fk_column_id: next.id, direction: 'asc' },
  )) as unknown as SortType
  sorts.value.push(created)
}

const patchSort = async (sort: SortType, patch: Partial<SortType>) => {
  Object.assign(sort, patch)
  await $api.internal.postOperation(
    wsId.value,
    baseId.value,
    { operation: 'sortUpdate', sortId: sort.id },
    { fk_column_id: sort.fk_column_id, direction: sort.direction },
  )
}

const removeSort = async (i: number) => {
  const sort = sorts.value[i]
  sorts.value.splice(i, 1)
  if (sort?.id) {
    await $api.internal.postOperation(wsId.value, baseId.value, { operation: 'sortDelete', sortId: sort.id }, {})
  }
}

onMounted(loadSorts)
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="nc-lookup-sort">
    <div v-for="(sort, i) in sorts" :key="sort.id || i" class="flex items-center gap-2">
      <a-select
        :value="sort.fk_column_id"
        class="flex-1"
        show-search
        :filter-option="antSelectFilterOption"
        dropdown-class-name="!rounded-md nc-dropdown-lookup-sort-column"
        @change="(v) => patchSort(sort, { fk_column_id: v })"
      >
        <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
        <a-select-option v-for="col of sortableColumns" :key="col.id" :value="col.id">
          <div class="flex items-center gap-2 truncate">
            <SmartsheetHeaderIcon :column="col" class="!mx-0" />
            <span class="truncate">{{ col.title }}</span>
          </div>
        </a-select-option>
      </a-select>
      <a-select
        :value="sort.direction"
        class="!w-32"
        dropdown-class-name="!rounded-md"
        @change="(v) => patchSort(sort, { direction: v })"
      >
        <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
        <a-select-option value="asc">First → Last</a-select-option>
        <a-select-option value="desc">Last → First</a-select-option>
      </a-select>
      <NcButton type="text" size="small" @click="removeSort(i)">
        <GeneralIcon icon="close" class="w-4 h-4" />
      </NcButton>
    </div>
    <div>
      <NcButton type="text" size="small" data-testid="nc-lookup-sort-add" @click="addSort">
        <div class="flex items-center gap-1"><GeneralIcon icon="plus" class="w-4 h-4" /> Add sort</div>
      </NcButton>
    </div>
  </div>
</template>
