<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

const { tables } = useProject()

const { metas, getMeta } = useMetas()
const meta = inject(MetaInj)

let isLoading = $ref(true)

const config = ref({
  showPkAndFk: true,
  showViews: false,
})

const relatedTables = computed(() =>
  tables.value.filter(
    (table) =>
      meta?.value.columns &&
      meta.value.columns.find(
        (column) => column.uidt === UITypes.LinkToAnotherRecord && column?.colOptions?.fk_related_model_id === table.id,
      ),
  ),
)

const loadMetaOfTablesNotInMetas = async () => {
  await Promise.all(
    relatedTables.value
      .filter((table) => !metas.value[table.id!])
      .map(async (table) => {
        await getMeta(table.id!)
      }),
  )
}

onMounted(async () => {
  await loadMetaOfTablesNotInMetas()
  isLoading = false
})

const localTables = computed(() => (meta ? [meta.value, ...relatedTables.value] : []))
</script>

<template>
  <div class="w-full" style="height: 70vh">
    <div v-if="isLoading" class="h-full w-full flex flex-col justify-center items-center">
      <div class="flex flex-row justify-center">
        <a-spin size="large" />
      </div>
    </div>
    <div v-else class="relative h-full">
      <ErdView :key="JSON.stringify(config)" :tables="localTables" :config="config" />

      <div class="absolute top-3 right-11 flex-col bg-white py-2 px-4 border-1 border-gray-100 rounded-md z-50 space-y-1">
        <div class="flex flex-row items-center">
          <a-checkbox v-model:checked="config.showPkAndFk" />
          <span class="ml-2" style="font-size: 0.65rem">Show PK and FK</span>
        </div>
      </div>
    </div>
  </div>
</template>
