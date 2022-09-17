<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

const { table } = defineProps<{ table?: TableType }>()

const { includeM2M } = useGlobal()

const { tables: projectTables } = useProject()

const { metas, getMeta } = useMetas()

let isLoading = $ref(true)
const erdKey = ref(0)
const showAdvancedOptions = ref(false)

const config = ref({
  showPkAndFk: true,
  showViews: false,
  showAllColumns: true,
  singleTableMode: !!table,
  showMMTables: false,
  showJunctionTableNames: false,
})

const tables = computed(() => {
  if (table) {
    // if table is provided only get the table and its related tables
    return projectTables.value.filter(
      (t) =>
        t.id === table.id ||
        table.columns?.find(
          (column) => column.uidt === UITypes.LinkToAnotherRecord && column?.colOptions?.fk_related_model_id === t.id,
        ),
    )
  }

  return projectTables.value
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

const tablesFilteredWithConfig = computed(() =>
  tables.value
    .filter(
      (t) =>
        config.value.showMMTables ||
        (!config.value.showMMTables && !t.mm) ||
        // Show mm table if its the selected table
        t.id === table?.id,
    )
    .filter((t) => (!config.value.showViews && t.type !== 'view') || config.value.showViews),
)

watch(
  () => config.value.showAllColumns,
  () => {
    config.value.showPkAndFk = config.value.showAllColumns
  },
)

watch(metas, () => {
  erdKey.value = erdKey.value + 1
})

watch(
  config,
  () => {
    erdKey.value = erdKey.value + 1
  },
  { deep: true },
)
</script>

<template>
  <div
    class="w-full"
    style="height: inherit"
    :class="{
      'nc-erd-vue-flow': !config.singleTableMode,
      'nc-erd-vue-flow-single-table': config.singleTableMode,
    }"
  >
    <div v-if="isLoading" class="h-full w-full flex flex-col justify-center items-center">
      <div class="flex flex-row justify-center">
        <a-spin size="large" />
      </div>
    </div>
    <div v-else class="relative h-full">
      <ErdSimpleView :key="erdKey" :tables="tablesFilteredWithConfig" :config="config" />

      <div
        class="absolute top-2 right-10 flex-col bg-white py-2 px-4 border-1 border-gray-100 rounded-md z-50 space-y-1 nc-erd-context-menu z-50"
      >
        <div class="flex flex-row items-center">
          <a-checkbox
            v-model:checked="config.showAllColumns"
            v-e="['c:erd:showAllColumns']"
            class="nc-erd-showColumns-checkbox"
          />
          <span
            class="ml-2 select-none nc-erd-showColumns-label"
            style="font-size: 0.65rem"
            @dblclick="showAdvancedOptions = true"
            >{{ $t('activity.erd.showColumns') }}</span
          >
        </div>
        <div class="flex flex-row items-center">
          <a-checkbox
            v-model:checked="config.showPkAndFk"
            v-e="['c:erd:showPkAndFk']"
            class="nc-erd-showPkAndFk-checkbox"
            :class="{
              'nc-erd-showPkAndFk-checkbox-enabled': config.showAllColumns,
              'nc-erd-showPkAndFk-checkbox-disabled': !config.showAllColumns,
              'nc-erd-showPkAndFk-checkbox-checked': config.showPkAndFk,
              'nc-erd-showPkAndFk-checkbox-unchecked': !config.showPkAndFk,
            }"
            :disabled="!config.showAllColumns"
          />
          <span class="ml-2 select-none" style="font-size: 0.65rem">{{ $t('activity.erd.showPkAndFk') }}</span>
        </div>
        <div v-if="!table" class="flex flex-row items-center">
          <a-checkbox v-model:checked="config.showViews" v-e="['c:erd:showViews']" class="nc-erd-showViews-checkbox" />
          <span class="ml-2 select-none" style="font-size: 0.65rem">{{ $t('activity.erd.showSqlViews') }}</span>
        </div>
        <div v-if="!table && showAdvancedOptions && includeM2M" class="flex flex-row items-center">
          <a-checkbox v-model:checked="config.showMMTables" v-e="['c:erd:showMMTables']" class="nc-erd-showMMTables-checkbox" />
          <span class="ml-2 select-none" style="font-size: 0.65rem">{{ $t('activity.erd.showMMTables') }}</span>
        </div>
        <div v-if="showAdvancedOptions && includeM2M" class="flex flex-row items-center">
          <a-checkbox
            v-model:checked="config.showJunctionTableNames"
            v-e="['c:erd:showJunctionTableNames']"
            class="nc-erd-showJunctionTableNames-checkbox"
          />
          <span class="ml-2 select-none" style="font-size: 0.65rem">{{ $t('activity.erd.showJunctionTableNames') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
