<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'

interface Props {
  reload?: boolean
}

const props = defineProps<Props>()

const searchSnapshotQuery = ref('')

const { t } = useI18n()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Webhook')

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateSort({
      field,
      direction,
    })
  },
})

const snapshots = ref([])

const columns = [
  {
    key: 'name',
    title: t('general.snapshot'),
    name: 'Snapshot',
    minWidth: 397,
    padding: '12px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'action',
    title: t('general.action'),
    width: 162,
    minWidth: 162,
    padding: '12px 24px',
  },
] as NcTableColumnProps[]

// Misc Settings

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const _projectId = inject(ProjectIdInj, undefined)
const { loadTables, hasEmptyOrNullFilters } = baseStore

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const showNullAndEmptyInFilter = ref()

const { includeM2M, showNull } = useGlobal()

watch(includeM2M, async () => await loadTables())

onMounted(async () => {
  await basesStore.loadProject(baseId.value!, true)
  showNullAndEmptyInFilter.value = basesStore.getProjectMeta(baseId.value!)?.showNullAndEmptyInFilter
})

async function showNullAndEmptyInFilterOnChange(evt: boolean) {
  const base = basesStore.bases.get(baseId.value!)
  if (!base) throw new Error(`Base ${baseId.value} not found`)

  const meta = basesStore.getProjectMeta(baseId.value!) ?? {}

  // users cannot hide null & empty option if there is existing null / empty filters
  if (!evt) {
    if (await hasEmptyOrNullFilters()) {
      showNullAndEmptyInFilter.value = true
      message.warning(t('msg.error.nullFilterExists'))
    }
  }
  const newProjectMeta = {
    ...meta,
    showNullAndEmptyInFilter: showNullAndEmptyInFilter.value,
  }
  // update local state
  base.meta = newProjectMeta
  // update db
  await basesStore.updateProject(baseId.value!, {
    meta: JSON.stringify(newProjectMeta),
  })
}
</script>

<template>
  <div class="flex h-[calc(100vh-92px)] flex-col items-center nc-base-settings pb-10 overflow-y-auto nc-scrollbar-x-lg px-6">
    <div class="item-card flex flex-col w-full">
      <div class="text-nc-content-gray-emphasis font-semibold text-lg">
        {{ $t('general.baseSnapshots') }}
      </div>

      <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
        {{ $t('labels.snapShotSubText') }}
      </div>

      <div class="flex items-center mt-6 gap-5">
        <a-input
          v-model:value="searchSnapshotQuery"
          class="w-full h-8 flex-1"
          size="small"
          :placeholder="$t('labels.searchASnapshot')"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="w-4 text-gray-500 h-4 mr-2" />
          </template>
        </a-input>
        <NcButton class="!w-36" size="small" type="secondary">
          {{ $t('labels.newSnapshot') }}
        </NcButton>
      </div>

      <NcTable
        v-model:order-by="orderBy"
        :columns="columns"
        :data="snapshots"
        class="h-full mt-5"
        body-row-class-name="nc-base-settings-snapshot-item"
      >
        <template #bodyCell="{ column, record: hook }">
          <template v-if="column.key === 'name'">
            <NcTooltip class="truncate max-w-full text-gray-800 font-semibold text-sm" show-on-truncate-only>
              {{ hook.title }}

              <template #title>
                {{ hook.title }}
              </template>
            </NcTooltip>
          </template>
          <template v-if="column.key === 'action'">
            <div class="flex items-center gap-2">
              <NcButton size="small" type="text" class="!text-xs">
                {{ $t('labels.edit') }}
              </NcButton>
              <NcButton size="small" type="text" class="!text-xs">
                {{ $t('labels.delete') }}
              </NcButton>
            </div>
          </template>
        </template>
      </NcTable>
    </div>

    <div class="item-card flex flex-col w-full">
      <div class="text-nc-content-gray-emphasis font-semibold text-lg">
        {{ $t('general.misc') }}
      </div>

      <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
        {{ $t('labels.miscBaseSettingsLabel') }}
      </div>

      <div class="flex flex-col border-1 rounded-lg mt-6 border-nc-border-gray-medium">
        <div class="flex w-full p-3 gap-2 flex-col">
          <div class="flex w-full items-center">
            <span class="text-nc-content-gray font-semibold flex-1">
              {{ $t('msg.info.showM2mTables') }}
            </span>
            <NcSwitch v-model:checked="includeM2M" v-e="['c:themes:show-m2m-tables']" class="ml-2" />
          </div>
          <span class="text-gray-500">{{ $t('msg.info.showM2mTablesDesc') }}</span>
        </div>

        <div class="flex w-full p-3 gap-2 flex-col">
          <div class="flex w-full items-center">
            <span class="text-nc-content-gray font-semibold flex-1">
              {{ $t('msg.info.showNullInCells') }}
            </span>
            <NcSwitch v-model:checked="showNull" v-e="['c:settings:show-null']" class="ml-2" />
          </div>
          <span class="text-gray-500">{{ $t('msg.info.showNullInCellsDesc') }}</span>
        </div>

        <div class="flex w-full p-3 gap-2 flex-col">
          <div class="flex w-full items-center">
            <span class="text-nc-content-gray font-semibold flex-1">
              {{ $t('msg.info.showNullAndEmptyInFilter') }}
            </span>
            <NcSwitch
              v-model:checked="showNullAndEmptyInFilter"
              v-e="['c:settings:show-null-and-empty-in-filter']"
              class="ml-2"
              @change="showNullAndEmptyInFilterOnChange"
            />
          </div>
          <span class="text-gray-500">{{ $t('msg.info.showNullAndEmptyInFilterDesc') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item-card {
  @apply p-6 rounded-2xl border-1 max-w-[600px] mt-10 min-w-100 w-full;
}

.ant-input::placeholder {
  @apply !text-nc-content-gray-muted;
}

.ant-input:placeholder-shown {
  @apply !text-nc-content-gray-muted !text-md;
}

.ant-input-affix-wrapper {
  @apply px-3 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
