<script lang="ts" setup>
import { ClientType, timeAgo } from 'nocodb-sdk'
import type { SourceType, TableType, ViewType } from 'nocodb-sdk'
import NcTooltip from '~/components/nc/Tooltip.vue'

const { activeTables } = storeToRefs(useTablesStore())

const viewStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewStore)

const { openTable } = useTablesStore()
const { openedProject, isDataSourceLimitReached } = storeToRefs(useBases())

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { isFeatureEnabled } = useBetaFeatureToggle()

const isNewBaseModalOpen = ref(false)

const isNewSyncModalOpen = ref(false)

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const { t } = useI18n()

const isImportModalOpen = ref(false)

const defaultBase = computed(() => {
  return openedProject.value?.sources?.[0]
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
    key: 'accordion',
    title: '',
    width: 56,
    padding: '0px 12px',
  },
  {
    key: 'name',
    title: t('general.name'),
    name: 'Name',
    width: 320,
    padding: '0px 12px 0 0',
  },
  {
    key: 'description',
    title: t('labels.description'),
    name: 'Description',
    padding: '0px 12px',
    minWidth: 101,
  },
  {
    key: 'sourceName',
    title: t('general.source'),
    name: 'View Name',
    width: 96,
    padding: '0px 12px',
  },
  {
    key: 'created_at',
    title: t('labels.createdOn'),
    name: 'editor',
    width: 144,
    padding: '0px 12px',
  },
] as NcTableColumnProps[]

const expandedTableIds = ref(new Set<string>())
const loadingViewsOfTableIds = ref(new Set<string>())

function isTableExpanded(tableId: string) {
  return expandedTableIds.value.has(tableId)
}

async function toggleTable(tableId: string) {
  if (loadingViewsOfTableIds.value.has(tableId)) return
  if (isTableExpanded(tableId)) expandedTableIds.value.delete(tableId)
  else {
    if (!viewsByTable.value.get(tableId)?.length) {
      loadingViewsOfTableIds.value.add(tableId)
      await viewStore.loadViews({ tableId, ignoreLoading: true })
      loadingViewsOfTableIds.value.delete(tableId)
    }
    expandedTableIds.value.add(tableId)
  }
}

const borderlessIndexRange = ref<[start: number, end: number][]>([])

const sortedActiveTables = computed(() => [...activeTables.value].sort((a, b) => a.source_id!.localeCompare(b.source_id!) * 20))

const tableAndViewData = computed(() => {
  const combined: Array<TableType | ViewType | { isEmptyView: true }> = []
  const indexRange: [start: number, end: number][] = []
  let i = 0
  for (const table of sortedActiveTables.value) {
    const tableId = table?.id ?? ''
    combined.push(table)
    if (isTableExpanded(tableId)) {
      const views: typeof combined = (viewsByTable.value.get(tableId) ?? []).filter((view) => !view.is_default)
      if (!views.length) {
        views.push({ isEmptyView: true })
      }
      combined.push(...views)
      indexRange.push([i, i + views.length])
      i += views.length + 1
    } else {
      i++
    }
  }
  borderlessIndexRange.value = indexRange
  return combined
})

function isRecordAView(record: Record<string, any>) {
  return !!record.fk_model_id
}

const customRow = (record: Record<string, any>, recordIndex: number) => ({
  onclick: async () => {
    if (isRecordAView(record)) {
      const view = record as ViewType
      await viewStore.navigateToView({
        view,
        tableId: view.fk_model_id,
        baseId: base.value.id!,
        doNotSwitchTab: true,
      })
    } else {
      openTable(record as TableType)
    }
  },
  class: borderlessIndexRange.value.some(([start, end]) => recordIndex >= start && recordIndex < end) ? 'no-bottom-border' : '',
})

const onCreateBaseClick = () => {
  if (isDataSourceLimitReached.value) return

  isNewBaseModalOpen.value = true
}

const onCreateSyncClick = () => {
  isNewSyncModalOpen.value = true
}

function getSourceIcon(source: SourceType) {
  if (source.is_meta || source.is_local) {
    return iconMap.nocodb1
  }
  if (baseStore.isMysql(source.id)) return allIntegrationsMapBySubType[ClientType.MYSQL].icon
  return allIntegrationsMapBySubType[source.type! as ClientType]?.icon ?? null
}

const sourceIdToIconMap = computed(() => {
  const map: Record<string, ReturnType<typeof getSourceIcon>> = {}
  for (const source of openedProject.value?.sources ?? []) {
    map[source.id!] = getSourceIcon(source)
  }
  return map
})
</script>

<template>
  <div class="nc-all-tables-view px-6 pt-6">
    <div
      class="flex flex-row gap-x-6 pb-2 overflow-x-auto nc-scrollbar-thin"
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
        <div class="icon-wrapper">
          <GeneralIcon icon="addOutlineBox" class="!h-8 !w-8 !text-brand-500" />
        </div>
        <div class="flex flex-col gap-1">
          <div class="label">{{ $t('general.create') }} {{ $t('general.new') }} {{ $t('objects.table') }}</div>
          <div class="subtext">{{ $t('msg.subText.createNewTable') }}</div>
        </div>
      </div>

      <div
        v-if="isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
        v-e="['c:table:import']"
        role="button"
        class="nc-base-view-all-table-btn"
        data-testid="proj-view-btn__import-data"
        @click="isImportModalOpen = true"
      >
        <div class="icon-wrapper">
          <GeneralIcon icon="download" class="!h-7.5 !w-7.5 !text-orange-700" />
        </div>
        <div class="flex flex-col gap-1">
          <div class="label">{{ $t('activity.import') }} {{ $t('general.data') }}</div>

          <div class="subtext">{{ $t('msg.subText.importData') }}</div>
        </div>
      </div>
      <NcTooltip
        v-if="isUIAllowed('sourceCreate')"
        placement="bottom"
        :disabled="!isDataSourceLimitReached"
        class="flex-none flex"
      >
        <template #title>
          {{ $t('tooltip.reachedSourceLimit') }}
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
          <div class="icon-wrapper">
            <GeneralIcon icon="server1" class="!h-7 !w-7 !text-green-700" />
          </div>
          <div class="flex flex-col gap-1">
            <div class="label">{{ $t('labels.connectDataSource') }}</div>
            <div class="subtext">{{ $t('msg.subText.connectExternalData') }}</div>
          </div>
        </div>
      </NcTooltip>
      <div
        v-if="isFeatureEnabled(FEATURE_FLAG.SYNC) && isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
        v-e="['c:table:create-sync']"
        role="button"
        class="nc-base-view-all-table-btn"
        data-testid="proj-view-btn__create-sync"
        @click="onCreateSyncClick"
      >
        <div class="icon-wrapper">
          <GeneralIcon icon="sync" class="!h-7 !w-7 !text-green-700" />
        </div>
        <div class="flex flex-col gap-1">
          <div class="label">Sync Data</div>
          <div class="subtext">With internal or external sources</div>
        </div>
      </div>
    </div>
    <div
      v-if="base?.isLoading"
      class="flex items-center justify-center text-center mt-4"
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
      class="flex mt-4"
      :style="{
        height: 'calc(100vh - var(--topbar-height) - 218px)',
      }"
    >
      <NcTable
        :is-data-loading="base?.isLoading"
        :columns="columns"
        sticky-first-column
        :data="tableAndViewData"
        :custom-row="customRow"
        :bordered="false"
        row-height="44px"
        header-row-height="44px"
        class="nc-base-view-all-table-list flex-1"
      >
        <template #bodyCell="{ column, record }">
          <div v-if="record.isEmptyView">
            <div v-if="column.key === 'name'" class="text-nc-content-gray-muted empty_views pl-[33px]">
              {{ $t('labels.noTableViews') }}
            </div>
          </div>
          <template v-else>
            <NcButton
              v-if="column.key === 'accordion' && !isRecordAView(record)"
              size="small"
              type="text"
              @click.stop="toggleTable(record.id)"
            >
              <div class="flex children:flex-none relative h-4 w-4">
                <Transition name="icon-fade" :duration="200">
                  <div v-if="loadingViewsOfTableIds.has(record.id)">
                    <GeneralLoader />
                  </div>
                  <div v-else>
                    <GeneralIcon
                      icon="chevronRight"
                      class="transform transition-transform duration-200"
                      :class="{ '!rotate-90': isTableExpanded(record.id) }"
                    />
                  </div>
                </Transition>
              </div>
            </NcButton>
            <template v-if="column.key === 'name'">
              <ProjectAllTablesViewRow v-if="isRecordAView(record)" :column="column" :record="record" />
              <div
                v-else
                class="w-full flex items-center gap-3 max-w-full text-gray-800"
                data-testid="proj-view-list__item-title"
              >
                <GeneralTableIcon :meta="record" class="flex-none h-4 w-4 !text-nc-content-gray-subtle" />

                <NcTooltip class="truncate font-weight-600 max-w-[calc(100%_-_28px)]" show-on-truncate-only>
                  <template #title>
                    {{ record?.title }}
                  </template>
                  {{ record?.title }}
                </NcTooltip>
              </div>
            </template>
            <div
              v-if="column.key === 'description'"
              class="w-full flex items-center gap-3 max-w-full text-gray-800 description"
              data-testid="proj-view-list__item-description"
            >
              <NcTooltip class="truncate max-w-[calc(100%_-_28px)]" show-on-truncate-only>
                <template #title>
                  {{ record?.description }}
                </template>
                {{ record?.description }}
              </NcTooltip>
            </div>
            <template v-if="column.key === 'sourceName'">
              <ProjectAllTablesViewRow v-if="isRecordAView(record)" :column="column" :record="record" />
              <div v-else class="w-full flex justify-center items-center max-w-full" data-testid="proj-view-list__item-type">
                <div class="w-8 h-8 flex justify-center items-center">
                  <component
                    :is="sourceIdToIconMap[record.source_id!]"
                    v-if="sourceIdToIconMap[record.source_id!]"
                    class="w-6 h-6"
                  />
                  <div v-else>-</div>
                </div>
              </div>
            </template>
            <div
              v-if="column.key === 'created_at'"
              class="flex items-center gap-2 max-w-full created_at"
              data-testid="proj-view-list__item-created-at"
            >
              {{ timeAgo(record?.created_at) }}
            </div>
          </template>
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
    <LazyDashboardSettingsDataSourcesCreateBase v-if="isNewBaseModalOpen" v-model:open="isNewBaseModalOpen" is-modal />
    <LazyDashboardSettingsSyncCreate v-if="isNewSyncModalOpen" v-model:open="isNewSyncModalOpen" />
  </div>
</template>

<style lang="scss" scoped>
.nc-base-view-all-table-btn {
  @apply flex-none flex flex-col gap-y-3 p-4 bg-gray-50 rounded-xl border-1 border-gray-100 min-w-[230px] max-w-[245px] cursor-pointer text-gray-800 hover:(bg-gray-100 border-gray-200) transition-all duration-300;
  &:hover {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  .icon-wrapper {
    @apply w-8 h-8 flex items-center;
  }

  .nc-icon {
    @apply flex-none h-10 w-10;
  }

  .label {
    @apply text-base font-bold whitespace-nowrap text-gray-800;
  }

  .subtext {
    @apply text-xs text-gray-600;
  }
}

.nc-base-view-all-table-btn.disabled {
  @apply bg-gray-50 text-gray-400 hover:(bg-gray-50 text-gray-400) cursor-not-allowed;
}

.nc-text-icon {
  @apply flex-none w-5 h-5 rounded bg-white text-gray-800 text-[6px] leading-4 font-weight-800 flex items-center justify-center;
}

.description,
.created_at,
.empty_views {
  @apply text-[13px] leading-[18px];
}

:deep(.no-bottom-border) {
  @apply !border-transparent;
}

:deep(.nc-table-header-cell-3) {
  > .gap-3 {
    @apply ml-[7px];
  }
}
</style>
