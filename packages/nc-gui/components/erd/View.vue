<script setup lang="ts">
import type { LinkToAnotherRecordType, SourceType, TableType } from 'nocodb-sdk'
import { isLinksOrLTAR } from 'nocodb-sdk'
import type { ERDConfig } from './utils'
import { reactive, ref, storeToRefs, useBase, useMetas, watch } from '#imports'

const props = defineProps({
  sourceId: {
    type: String,
    default: '',
  },
  table: {
    type: Object as PropType<TableType>,
    default: null,
  },
  showAllColumns: {
    type: Boolean,
    default: true,
  },
  baseId: {
    type: String,
    default: undefined,
  },
})

const { baseTables: _baseTables } = storeToRefs(useTablesStore())
const { sources, base } = storeToRefs(useBase())

const baseId = computed(() => props.baseId ?? base.value!.id)

const baseTables = computed(() => _baseTables.value.get(baseId.value) ?? [])

const { metas, getMeta } = useMetas()

const tables = ref<TableType[]>([])

const isLoading = ref(true)

const config = reactive<ERDConfig>({
  showPkAndFk: true,
  showViews: false,
  showAllColumns: props.showAllColumns,
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
    // use getMeta method to load meta since it will get meta if not loaded already
    const tableMeta = await getMeta(props.table!.id!)

    // if table is provided only get the table and its related tables
    localTables = baseTables.value.filter(
      (t) =>
        t.id === props.table?.id ||
        tableMeta.columns?.find((column) => {
          return isLinksOrLTAR(column.uidt) && (column.colOptions as LinkToAnotherRecordType)?.fk_related_model_id === t.id
        }),
    )
  } else {
    localTables = baseTables.value
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

  isLoading.value = false
}

const toggleFullScreen = () => {
  config.isFullScreen = !config.isFullScreen
}

watch([metas, baseTables], populateTables, {
  flush: 'post',
  immediate: true,
})

watch(config, populateTables, {
  flush: 'post',
  deep: true,
})

const filteredTables = computed(() =>
  tables.value.filter((t) =>
    props?.sourceId
      ? t.source_id === props.sourceId
      : t.source_id === sources.value?.filter((source: SourceType) => source.enabled)[0].id,
  ),
)

watch(
  () => config.showAllColumns,
  () => {
    config.showPkAndFk = config.showAllColumns
  },
)
</script>

<template>
  <div
    class="w-full bg-white border-1 border-gray-100 rounded-lg"
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
