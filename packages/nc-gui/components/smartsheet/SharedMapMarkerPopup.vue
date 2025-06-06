<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  fields: ColumnType[]
  row: Row
}>()

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const { withLoading } = useLoadingTrigger()
const { loadData } = useViewData(meta, view)

provide(IsFormInj, ref(false))
provide(IsGridInj, ref(false))

reloadViewDataHook?.on(
  withLoading(async () => {
    await loadData()
  }),
)

onMounted(async () => {
  await loadData()
})

provide(ReloadRowDataHookInj, reloadViewDataHook!)

const currentRow = toRef(props, 'row')

useProvideSmartsheetRowStore(currentRow)
</script>

<template>
  <LazySmartsheetRow :row="currentRow">
    <a-card
      hoverable
      class="!rounded-lg h-full overflow-hidden break-all max-w-[450px]"
      :data-testid="`nc-shared-map-marker-popup-card-${currentRow.row.id}`"
    >
      <div v-for="col in fields" :key="`record-${currentRow.row.id}-${col.id}`">
        <div
          v-if="!isRowEmpty(currentRow, col) || isLTAR(col.uidt, colOptions)"
          class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full"
        >
          <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
            <div class="w-full text-gray-600">
              <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />

              <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
            </div>
          </div>

          <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
            <LazySmartsheetVirtualCell
              v-if="isVirtualCol(col)"
              v-model="currentRow.row[col.title]"
              :column="col"
              :row="currentRow"
            />

            <LazySmartsheetCell
              v-else
              v-model="currentRow.row[col.title]"
              :column="col"
              :edit-enabled="false"
              :read-only="true"
            />
          </div>
        </div>
      </div>
    </a-card>
  </LazySmartsheetRow>
</template>
