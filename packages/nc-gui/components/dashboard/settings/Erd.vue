<script setup lang="ts">
import Erd from '~/components/erd/Erd.vue'

const { tables } = useProject()

const { metas, getMeta } = useMetas()

let isLoading = $ref(true)

const config = ref({
  showPkAndFk: true,
  showViews: false,
})

const loadMetaOfTablesNotInMetas = async () => {
  await Promise.all(
    tables.value
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

const localTables = computed(() =>
  tables.value.filter((table) => (!config.value.showViews && table.type !== 'view') || config.value.showViews),
)
</script>

<template>
  <div v-if="isLoading" style="height: 650px"></div>
  <div v-else class="relative" style="height: 650px">
    <Erd :key="JSON.stringify(config)" :tables="localTables" :config="config" />

    <div class="absolute top-4 right-4 flex-col bg-white py-2 px-4 border-1 border-gray-100 rounded-md z-50 space-y-1">
      <div class="flex flex-row items-center">
        <a-checkbox v-model:checked="config.showPkAndFk" />
        <span class="ml-2" style="font-size: 0.65rem">Show PK and FK</span>
      </div>
      <div class="flex flex-row items-center">
        <a-checkbox v-model:checked="config.showViews" />
        <span class="ml-2" style="font-size: 0.65rem">Show views</span>
      </div>
    </div>
  </div>
</template>
