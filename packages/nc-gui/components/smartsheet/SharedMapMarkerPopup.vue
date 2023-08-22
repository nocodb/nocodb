<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'

import { isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGridInj,
  MetaInj,
  PaginationDataInj,
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  inject,
  isLTAR,
  onMounted,
  provide,
  ref,
  useViewData,
} from '#imports'
import type { Row } from '~/lib'

const props = defineProps<{
  fields: ColumnType[]
  row: Row
}>()

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewDataHook = inject(ReloadViewDataHookInj)

const { loadData, paginationData, changePage } = useViewData(meta, view)

provide(IsFormInj, ref(false))
provide(IsGridInj, ref(false))
provide(PaginationDataInj, paginationData)
provide(ChangePageInj, changePage)

const fields = inject(FieldsInj, ref([]))

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}

reloadViewDataHook?.on(async () => {
  await loadData()
})

onMounted(async () => {
  await loadData()
})

provide(ReloadRowDataHookInj, reloadViewDataHook)

const currentRow = toRef(props, 'row')

const { row } = useProvideSmartsheetRowStore(meta as Ref<TableType>, currentRow)
</script>

<template>
  <LazySmartsheetRow :row="row">
    <a-card
      hoverable
      class="!rounded-lg h-full overflow-hidden break-all max-w-[450px]"
      :data-testid="`nc-shared-map-marker-popup-card-${row.row.id}`"
    >
      <div v-for="col in fields" :key="`record-${row.row.id}-${col.id}`">
        <div
          v-if="!isRowEmpty(row, col) || isLTAR(col.uidt)"
          class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full"
        >
          <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
            <div class="w-full text-gray-600">
              <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />

              <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
            </div>
          </div>

          <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
            <LazySmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :column="col" :row="row" />

            <LazySmartsheetCell v-else v-model="row.row[col.title]" :column="col" :edit-enabled="false" :read-only="true" />
          </div>
        </div>
      </div>
    </a-card>
  </LazySmartsheetRow>
</template>
