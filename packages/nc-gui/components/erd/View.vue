<script setup lang="ts">
import type { LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { ERDConfig } from './utils'
import { reactive, ref, useMetas, useProject, watch } from '#imports'

const props = defineProps<{ table?: TableType; baseId?: string }>()

const { tables: projectTables } = useProject()

const { metas, getMeta } = useMetas()

const tables = ref<TableType[]>([])

let isLoading = $ref(true)

const config = reactive<ERDConfig>({
  showPkAndFk: true,
  showViews: false,
  showAllColumns: true,
  singleTableMode: !!props.table,
  showMMTables: false,
  showJunctionTableNames: false,
  isFullScreen: false,
})

const loadMetaOfTablesNotInMetas = async (localTables: TableType[]) => {
  await Promise.all(
    localTables
      .filter((table) => !metas.value[table.id!])
      .map(async (table) => {
        await getMeta(table.id!)
      }),
  )
}

const populateTables = async () => {
  let localTables: TableType[] = []
  if (props.table) {
    // if table is provided only get the table and its related tables
    localTables = projectTables.value.filter(
      (t) =>
        t.id === props.table.id ||
        props.table.columns?.find(
          (column) =>
            column.uidt === UITypes.LinkToAnotherRecord &&
            (column.colOptions as LinkToAnotherRecordType)?.fk_related_model_id === t.id,
        ),
    )
  } else {
    localTables = projectTables.value
  }

  await loadMetaOfTablesNotInMetas(localTables)

  tables.value = localTables
    .filter(
      (t) =>
        config.showMMTables ||
        (!config.showMMTables && !t.mm) ||
        // Show mm table if it's the selected table
        t.id === props.table?.id,
    )
    .filter((t) => config.singleTableMode || (!config.showViews && t.type !== 'view') || config.showViews)

  isLoading = false
}

const toggleFullScreen = () => {
  config.isFullScreen = !config.isFullScreen
}

watch([metas, projectTables], populateTables, {
  flush: 'post',
  immediate: true,
})

watch(config, populateTables, {
  flush: 'post',
  deep: true,
})

const filteredTables = computed(() => tables.value.filter((t) => !props.baseId || t.base_id === props.baseId))

watch(
  () => config.showAllColumns,
  () => {
    config.showPkAndFk = config.showAllColumns
  },
)
</script>

<template>
  <div
    class="w-full bg-white"
    :class="{
      'z-100 h-screen w-screen fixed top-0 left-0 right-0 bottom-0': config.isFullScreen,
      'nc-erd-vue-flow-single-table': config.singleTableMode,
      'nc-erd-vue-flow': !config.singleTableMode,
    }"
    :style="!config.isFullScreen ? 'height: inherit' : ''"
  >
    <div class="relative h-full">
      <LazyErdFlow :tables="filteredTables" :config="config">
        <GeneralOverlay v-model="isLoading" inline class="bg-gray-300/50">
          <div class="h-full w-full flex flex-col justify-center items-center">
            <a-spin size="large" />
          </div>
        </GeneralOverlay>

        <ErdFullScreenToggle :config="config" @toggle-full-screen="toggleFullScreen" />
        <ErdConfigPanel :config="config" />
        <ErdHistogramPanel v-if="!config.singleTableMode" />
      </LazyErdFlow>
    </div>
  </div>
</template>
