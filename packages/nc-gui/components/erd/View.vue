<script setup lang="ts">
import type { LinkToAnotherRecordType, SourceType, TableType } from 'nocodb-sdk'
import { isLinksOrLTAR } from 'nocodb-sdk'
import type { ERDConfig } from './utils'

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

const { bases } = storeToRefs(useBases())

const { base: activeBase } = storeToRefs(useBase())

const baseId = computed(() => props.baseId ?? activeBase.value!.id!)

const tablesStore = useTablesStore()
const { baseTables: _baseTables } = storeToRefs(tablesStore)

const baseTables = computed(() => _baseTables.value.get(baseId.value) ?? [])

const sources = computed<SourceType[]>(() => bases.value.get(baseId.value)?.sources || [])

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

const fetchMissingTableMetas = async (localTables: TableType[]) => {
  const chunkSize = 5

  // Function to process a chunk of tables
  const processChunk = async (chunk: TableType[]) => {
    await Promise.all(
      chunk.map(async (table) => {
        await getMeta(table.id!)
      }),
    )
  }

  // filter out tables that are already loaded and are not from the same source
  const filteredTables = localTables.filter((t) => !metas.value[t.id!] && t.source_id === props.sourceId)

  // Split the tables into chunks and process each chunk sequentially to avoid hitting throttling limits
  for (let i = 0; i < filteredTables.length; i += chunkSize) {
    const chunk = filteredTables.slice(i, i + chunkSize)
    await processChunk(chunk)
  }
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

  await fetchMissingTableMetas(localTables)

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

onMounted(async () => {
  if (!props.baseId) return

  if (!_baseTables.value.get(props.baseId)) {
    await tablesStore.loadProjectTables(props.baseId)
  }
})
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
