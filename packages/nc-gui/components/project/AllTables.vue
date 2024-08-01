<script lang="ts" setup>
import type { SourceType, TableType } from 'nocodb-sdk'
import dayjs from 'dayjs'

const { activeTables } = storeToRefs(useTablesStore())
const { openTable } = useTablesStore()
const { openedProject } = storeToRefs(useBases())

const { base } = storeToRefs(useBase())

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const { t } = useI18n()

const isImportModalOpen = ref(false)

const defaultBase = computed(() => {
  return openedProject.value?.sources?.[0]
})

const sources = computed(() => {
  // Convert array of sources to map of sources

  const baseMap = new Map<string, SourceType>()

  openedProject.value?.sources?.forEach((source) => {
    baseMap.set(source.id!, source)
  })

  return baseMap
})

function openTableCreateDialog(baseIndex?: number | undefined) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  let sourceId = openedProject.value!.sources?.[0].id
  if (typeof baseIndex === 'number') {
    sourceId = openedProject.value!.sources?.[baseIndex].id
  }

  if (!sourceId || !openedProject.value?.id) return

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    sourceId, // || sources.value[0].id,
    'baseId': openedProject.value.id,
    'onCreate': closeDialog,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isOpen.value = false

    if (!table) return

    // TODO: Better way to know when the table node dom is available
    setTimeout(() => {
      const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
      if (!newTableDom) return

      newTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 1000)

    close(1000)
  }
}

const columns = [
  {
    key: 'tableName',
    title: t('objects.table'),
    name: 'Table Name',
    basis: '40%',
    minWidth: 220,
    padding: '0px 12px',
  },
  {
    key: 'sourceName',
    title: t('general.source'),
    name: 'View Name',
    basis: '25%',
    minWidth: 220,
    padding: '0px 12px',
  },
  {
    key: 'created_at',
    title: t('labels.createdOn'),
    name: 'editor',
    minWidth: 120,
    padding: '0px 12px',
  },
] as NcTableColumnProps[]

const customRow = (record: Record<string, any>) => ({
  onclick: () => {
    openTable(record as TableType)
  },
})
</script>

<template>
  <div class="nc-all-tables-view">
    <div
      class="flex flex-row gap-x-6 pb-3 pt-6"
      :class="{
        'pointer-events-none': base?.isLoading,
      }"
    >
      <div
        v-if="isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
        role="button"
        class="nc-base-view-all-table-btn"
        data-testid="proj-view-btn__add-new-table"
        @click="openTableCreateDialog()"
      >
        <GeneralIcon icon="addOutlineBox" />
        <div class="label">{{ $t('general.new') }} {{ $t('objects.table') }}</div>
      </div>
      <div
        v-if="isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
        v-e="['c:table:import']"
        role="button"
        class="nc-base-view-all-table-btn"
        data-testid="proj-view-btn__import-data"
        @click="isImportModalOpen = true"
      >
        <GeneralIcon icon="download" />
        <div class="label">{{ $t('activity.import') }} {{ $t('general.data') }}</div>
      </div>
      <!--      <component :is="isDataSourceLimitReached ? NcTooltip : 'div'" v-if="isUIAllowed('sourceCreate')">
        <template #title>
          <div>
            {{ $t('tooltip.reachedSourceLimit') }}
          </div>
        </template>
        <div
          v-e="['c:table:create-source']"
          role="button"
          class="nc-base-view-all-table-btn"
          data-testid="proj-view-btn__create-source"
          :class="{
            disabled: isDataSourceLimitReached,
          }"
          @click="onCreateBaseClick"
        >
          <GeneralIcon icon="dataSource" />
          <div class="label">{{ $t('labels.connectDataSource') }}</div>
        </div>
      </component> -->
    </div>
    <div
      v-if="base?.isLoading"
      class="flex items-center justify-center text-center"
      :style="{
        height: 'calc(100vh - var(--topbar-height) - 15.2rem)',
      }"
    >
      <div>
        <GeneralLoader size="xlarge" />
        <div class="mt-2">
          {{ $t('general.loading') }}
        </div>
      </div>
    </div>

    <div
      v-else-if="activeTables.length"
      class="flex mt-2"
      :style="{
        height: 'calc(100vh - var(--topbar-height) - 15.2rem)',
      }"
    >
      <NcTable
        :is-data-loading="base?.isLoading"
        :columns="columns"
        sticky-first-column
        :data="[...activeTables].sort(
          (a, b) => a.source_id!.localeCompare(b.source_id!) * 20
        )"
        :custom-row="customRow"
        :bordered="false"
        class="nc-base-view-all-table-list flex-1"
      >
        <template #bodyCell="{ column, record }">
          <div
            v-if="column.key === 'tableName'"
            class="w-full flex items-center gap-3 max-w-full text-gray-800 font-semibold"
            data-testid="proj-view-list__item-title"
          >
            <div class="min-w-5 flex items-center justify-center">
              <GeneralTableIcon :meta="record" class="flex-none text-gray-600" />
            </div>
            <NcTooltip class="truncate max-w-[calc(100%_-_28px)]" show-on-truncate-only>
              <template #title>
                {{ record?.title }}
              </template>
              {{ record?.title }}
            </NcTooltip>
          </div>
          <div
            v-if="column.key === 'sourceName'"
            class="capitalize w-full flex items-center gap-3 max-w-full"
            data-testid="proj-view-list__item-type"
          >
            <div v-if="record.source_id === defaultBase?.id" class="ml-0.75">-</div>
            <template v-else>
              <GeneralBaseLogo class="flex-none w-4" />

              <NcTooltip class="truncate max-w-[calc(100%_-_28px)]" show-on-truncate-only>
                <template #title>
                  {{ sources.get(record.source_id!)?.alias }}
                </template>
                {{ sources.get(record.source_id!)?.alias }}
              </NcTooltip>
            </template>
          </div>
          <div
            v-if="column.key === 'created_at'"
            class="capitalize flex items-center gap-2 max-w-full"
            data-testid="proj-view-list__item-created-at"
          >
            {{ dayjs(record?.created_at).fromNow() }}
          </div>
        </template>
      </NcTable>
    </div>
    <div v-else class="py-3 flex items-center gap-6 <lg:flex-col">
      <img src="~assets/img/placeholder/table.png" class="!w-[23rem] flex-none" />
      <div class="text-center lg:text-left">
        <div class="text-2xl text-gray-800 font-bold">{{ $t('placeholder.createTable') }}</div>
        <div class="text-sm text-gray-700 pt-6">
          {{ $t('placeholder.createTableLabel') }}
        </div>
      </div>
    </div>

    <ProjectImportModal v-if="defaultBase" v-model:visible="isImportModalOpen" :source="defaultBase" />
    <!--    <LazyDashboardSettingsDataSourcesCreateBase v-model:open="isNewBaseModalOpen" /> -->
  </div>
</template>

<style lang="scss" scoped>
.nc-base-view-all-table-btn {
  @apply flex flex-col gap-y-6 p-4 bg-gray-100 rounded-xl w-56 cursor-pointer text-gray-600 hover:(bg-gray-200 text-black);

  .nc-icon {
    @apply h-10 w-10;
  }

  .label {
    @apply text-base font-medium;
  }
}

.nc-base-view-all-table-btn.disabled {
  @apply bg-gray-50 text-gray-400 hover:(bg-gray-50 text-gray-400) cursor-not-allowed;
}
</style>
