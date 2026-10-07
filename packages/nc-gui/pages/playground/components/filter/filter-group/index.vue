<script lang="ts" setup>
import { ClientType } from 'nocodb-sdk'
import PgDemo from '../../../-components/PgDemo.vue'
import PgPage from '../../../-components/PgPage.vue'
import PgSection from '../../../-components/PgSection.vue'
import { mockSetupInit } from '../../../-helper/mock-setup'
import MockInjection from '../../MockInjection.vue'

const SECTIONS = [
  { id: 'props', title: 'Props & events' },
  { id: 'demos', title: 'Demos' },
]

const BOOLEAN_PROPS = [
  'disabled',
  'isLogicalOpChangeAllowed',
  'isLockedView',
  'showNullAndEmptyInFilter',
  'isFullWidth',
  'webHook',
  'link',
  'isForm',
  'isPublic',
  'queryFilter',
  'disableAddNewFilter',
  'parentEnabled',
] as const

const NUMBER_PROPS = ['index', 'nestedLevel', 'filterPerViewLimit', 'filtersCount'] as const

const { metas } = useMetas()

const rootMeta = ref({})

const filters = ref<ColumnFilterType[]>([])

const options1 = ref({
  index: 0,
  nestedLevel: 0,
  disabled: false,
  isLockedView: false,
  isFullWidth: false,
  isLogicalOpChangeAllowed: false,
  showNullAndEmptyInFilter: false,
  dbClientType: ClientType.PG,
  actionBtnType: 'text',
  webHook: false,
  link: false,
  isForm: false,
  isPublic: false,
  filterPerViewLimit: 50,
  filtersCount: 0,
  queryFilter: false,
  disableAddNewFilter: false,
  // boolean prop: omitting it reads as false and greys every row out
  parentEnabled: true,
})

const lastChangeEvent1 = ref({})

const lastRowChangeEvent1 = ref({})

const columns = computedAsync(async () => {
  if (!metas.value || Object.keys(metas.value).length === 0) return []
  return await composeColumnsForFilter({
    rootMeta: rootMeta.value,
    getMeta: async (id) => metas.value[`${rootMeta.value?.base_id}:${id}`],
  })
}, [])

// FilterGroup also sends the new filter's tmp_id, and the parent group on copy
type GroupEvent = FilterGroupChangeEvent & { tmp_id?: string }

type CopyEvent = FilterRowChangeEvent & { parentFilter?: ColumnFilterType }

function siblingsOf(parent?: ColumnFilterType | null): ColumnFilterType[] {
  if (!parent) return filters.value
  parent.children ??= []
  return parent.children
}

function levelOf(list: ColumnFilterType[], filter: ColumnFilterType): ColumnFilterType[] | undefined {
  if (list.includes(filter)) return list
  for (const f of list) {
    const level = f.children && levelOf(f.children, filter)
    if (level) return level
  }
}

function cloneFilter(filter: ColumnFilterType): ColumnFilterType {
  return {
    ...filter,
    id: undefined,
    tmp_id: Math.random().toString(36).substring(2, 15),
    children: filter.children?.map(cloneFilter),
  }
}

const handler = {
  addFilter: async (event: GroupEvent) => {
    siblingsOf(event.parentFilter).push({
      tmp_id: event.tmp_id,
      fk_column_id: columns.value[1]?.id,
      comparison_op: 'eq',
      is_group: false,
      logical_op: 'and',
      fk_parent_id: event.fk_parent_id,
    })
  },
  addFilterGroup: async (event: GroupEvent) => {
    siblingsOf(event.parentFilter).push({
      tmp_id: event.tmp_id,
      is_group: true,
      logical_op: 'and',
      children: [],
      fk_parent_id: event.fk_parent_id,
    })
  },
  deleteFilter: async (event: GroupEvent) => {
    if (!event.filter) return
    const list = siblingsOf(event.parentFilter)
    const at = list.indexOf(event.filter)
    if (at !== -1) list.splice(at, 1)
  },
  copyFilter: async (event: CopyEvent) => {
    const list = siblingsOf(event.parentFilter)
    const at = list.indexOf(event.filter)
    if (at !== -1) list.splice(at + 1, 0, cloneFilter(event.filter))
  },
  rowChange: async (event: FilterRowChangeEvent) => {
    event.filter[event.type] = event.value
    if (event.type === 'logical_op') {
      for (const sibling of levelOf(filters.value, event.filter) ?? []) sibling.logical_op = event.value
    }
    const evalColumn = columns.value.find((k) => k.id === event.filter.fk_column_id)
    if (evalColumn && event.type === 'fk_column_id') {
      adjustFilterWhenColumnChange({
        column: evalColumn,
        filter: event.filter,
        showNullAndEmptyInFilter: options1.value.showNullAndEmptyInFilter,
      })
    }
  },
}

// FilterGroup adds a `parentFilter` back-reference, which JSON can't serialize
function toJson(value: unknown) {
  return JSON.stringify(value, (key, val) => (key === 'parentFilter' ? undefined : val), 2)
}

function onChange(event) {
  lastChangeEvent1.value = event
}

function onRowChange(event) {
  lastRowChangeEvent1.value = event
}

onMounted(async () => {
  const setup = await mockSetupInit()
  rootMeta.value = setup.meta
})
</script>

<template>
  <MockInjection>
    <PgPage
      title="Filters"
      description="SmartsheetToolbarFilterGroup on mock table metadata. The knobs below drive all three demos, which share one filter list."
      :sections="SECTIONS"
    >
      <PgSection id="props" title="Props & events" source="SmartsheetToolbarFilterGroup">
        <PgDemo label="Props">
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
              <label v-for="prop in BOOLEAN_PROPS" :key="prop" class="flex items-center gap-2 cursor-pointer">
                <NcSwitch v-model:checked="options1[prop]" size="small" />
                <span class="text-captionSm text-nc-content-gray font-mono">{{ prop }}</span>
              </label>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-4 border-t-1 border-nc-border-gray-light">
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">dbClientType</span>
                <NcSelect v-model:value="options1.dbClientType">
                  <a-select-option v-for="client in Object.values(ClientType)" :key="client" :value="client">
                    {{ client }}
                  </a-select-option>
                </NcSelect>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">actionBtnType</span>
                <NcSelect v-model:value="options1.actionBtnType">
                  <a-select-option value="text">text</a-select-option>
                  <a-select-option value="secondary">secondary</a-select-option>
                </NcSelect>
              </div>
              <div v-for="prop in NUMBER_PROPS" :key="prop" class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">{{ prop }}</span>
                <a-input-number v-model:value="options1[prop]" :min="0" class="!w-full !rounded-lg" />
              </div>
            </div>
          </div>
        </PgDemo>

        <PgDemo label="Events" hint="last @row-change and @change payloads">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-captionXs text-nc-content-gray-muted font-mono">row-change</span>
              <pre
                class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-lg p-3 overflow-auto max-h-48 !m-0"
                >{{ toJson(lastRowChangeEvent1) }}</pre
              >
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-captionXs text-nc-content-gray-muted font-mono">change</span>
              <pre
                class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-lg p-3 overflow-auto max-h-48 !m-0"
                >{{ toJson(lastChangeEvent1) }}</pre
              >
            </div>
          </div>
        </PgDemo>
      </PgSection>

      <PgSection id="demos" title="Demos">
        <PgDemo label="Simple" hint="v-model only, no handler">
          <SmartsheetToolbarFilterGroup
            v-model="filters"
            :index="options1.index"
            :nested-level="options1.nestedLevel"
            :columns="columns"
            :db-client-type="options1.dbClientType"
            :show-null-and-empty-in-filter="options1.showNullAndEmptyInFilter"
            :disabled="options1.disabled"
            :is-locked-view="options1.isLockedView"
            :is-logical-op-change-allowed="options1.isLogicalOpChangeAllowed"
            :is-full-width="options1.isFullWidth"
            :action-btn-type="options1.actionBtnType"
            :web-hook="options1.webHook"
            :link="options1.link"
            :is-form="options1.isForm"
            :is-public="options1.isPublic"
            :filter-per-view-limit="options1.filterPerViewLimit"
            :disable-add-new-filter="options1.disableAddNewFilter"
            :filters-count="options1.filtersCount"
            :query-filter="options1.queryFilter"
            :parent-enabled="options1.parentEnabled"
            @change="onChange"
            @row-change="onRowChange"
          />
        </PgDemo>

        <PgDemo label="With handler" hint="handler owns add / delete / row change">
          <SmartsheetToolbarFilterGroup
            v-model="filters"
            :index="options1.index"
            :nested-level="options1.nestedLevel"
            :columns="columns"
            :db-client-type="options1.dbClientType"
            :show-null-and-empty-in-filter="options1.showNullAndEmptyInFilter"
            :disabled="options1.disabled"
            :is-locked-view="options1.isLockedView"
            :is-logical-op-change-allowed="options1.isLogicalOpChangeAllowed"
            :is-full-width="options1.isFullWidth"
            :action-btn-type="options1.actionBtnType"
            :web-hook="options1.webHook"
            :link="options1.link"
            :is-form="options1.isForm"
            :is-public="options1.isPublic"
            :filter-per-view-limit="options1.filterPerViewLimit"
            :disable-add-new-filter="options1.disableAddNewFilter"
            :filters-count="options1.filtersCount"
            :query-filter="options1.queryFilter"
            :parent-enabled="options1.parentEnabled"
            :handler="handler"
            @change="onChange"
            @row-change="onRowChange"
          />
        </PgDemo>

        <PgDemo label="Custom toolbar" hint="#root-header slot, root level only">
          <SmartsheetToolbarFilterGroup
            v-model="filters"
            :index="options1.index"
            :nested-level="options1.nestedLevel"
            :columns="columns"
            :db-client-type="options1.dbClientType"
            :show-null-and-empty-in-filter="options1.showNullAndEmptyInFilter"
            :disabled="options1.disabled"
            :is-locked-view="options1.isLockedView"
            :is-logical-op-change-allowed="options1.isLogicalOpChangeAllowed"
            :is-full-width="options1.isFullWidth"
            :action-btn-type="options1.actionBtnType"
            :web-hook="options1.webHook"
            :link="options1.link"
            :is-form="options1.isForm"
            :is-public="options1.isPublic"
            :filter-per-view-limit="options1.filterPerViewLimit"
            :disable-add-new-filter="options1.disableAddNewFilter"
            :filters-count="options1.filtersCount"
            :query-filter="options1.queryFilter"
            :parent-enabled="options1.parentEnabled"
            @change="onChange"
            @row-change="onRowChange"
          >
            <template #root-header>
              <div class="text-captionSmBold text-nc-content-gray-subtle">Custom root header</div>
            </template>
          </SmartsheetToolbarFilterGroup>
        </PgDemo>
      </PgSection>
    </PgPage>
  </MockInjection>
</template>
