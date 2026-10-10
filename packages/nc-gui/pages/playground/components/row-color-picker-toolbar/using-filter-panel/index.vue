<script lang="ts" setup>
import type { ColumnType, FilterType, RowColoringInfoFilter, RowColoringInfoFilterRow, RowColoringMode } from 'nocodb-sdk'
import { ClientType, ROW_COLORING_MODE, UITypes } from 'nocodb-sdk'
import PgDemo from '../../../-components/PgDemo.vue'
import PgPage from '../../../-components/PgPage.vue'
import PgSection from '../../../-components/PgSection.vue'
import { mockSetupInit } from '../../../-helper/mock-setup'
import MockInjection from '../../MockInjection.vue'

const SECTIONS = [
  { id: 'filter-panel', title: 'Using filter panel' },
  { id: 'single-select-panel', title: 'Using single select' },
  { id: 'type-option', title: 'Mode picker' },
]

const BOOLEAN_PROPS = ['disabled', 'isLockedView'] as const

const SELECT_COLUMNS: ColumnType[] = [
  { id: 'col_status', title: 'Status', uidt: UITypes.SingleSelect },
  { id: 'col_priority', title: 'Priority', uidt: UITypes.SingleSelect },
]

const { metas } = useMetas()

const vModel = ref<RowColoringInfoFilter>({ mode: ROW_COLORING_MODE.FILTER, conditions: [] })

const rootMeta = ref({})

const options1 = ref({
  filterPerViewLimit: 5,
  disabled: false,
  isLockedView: false,
  dbClientType: ClientType.PG,
})

const selectVModel = ref({
  is_set_as_background: false,
  fk_column_id: '',
})

const removeClicked = ref(0)

const rowColoringMode = ref<RowColoringMode>(null)

const columns = computedAsync(async () => {
  if (!metas.value || Object.keys(metas.value).length === 0) return []
  return await composeColumnsForFilter({
    rootMeta: rootMeta.value,
    getMeta: async (id) => metas.value[`${rootMeta.value?.base_id}:${id}`],
  })
}, [])

let localSeq = 0

const localId = (prefix: string) => `pg-${prefix}-${++localSeq}`

const conditionsOf = () => vModel.value.conditions

function newFilter(conditionId: string, extra: Partial<FilterType> = {}): FilterType {
  const column = columns.value.find((c) => c.pv) ?? columns.value[0]
  const filter: FilterType = {
    id: localId('filter'),
    fk_row_color_condition_id: conditionId,
    fk_column_id: column?.id,
    comparison_op: 'eq',
    is_group: false,
    logical_op: 'and',
    order: 1,
    ...extra,
  }
  adjustFilterWhenColumnChange({ column, filter, showNullAndEmptyInFilter: false })
  return filter
}

function attachFilter(condition: RowColoringInfoFilterRow, filter: FilterType, event: FilterGroupChangeEvent) {
  condition.conditions.push(filter)
  const parent = event.fk_parent_id ? condition.conditions.find((f) => f.id === event.fk_parent_id) : event.parentFilter
  if (parent) (parent.children ??= []).push(filter)
  else condition.nestedConditions.push(filter)
}

function cloneFilter(filter: FilterType, conditionId: string): FilterType {
  return {
    ...filter,
    id: localId('filter'),
    fk_row_color_condition_id: conditionId,
    children: filter.children?.map((child) => cloneFilter(child, conditionId)),
  }
}

function dropFilter(list: FilterType[], id?: string) {
  const at = list.findIndex((f) => f.id === id)
  if (at !== -1) list.splice(at, 1)
  for (const f of list) if (f.children) dropFilter(f.children, id)
}

const rowColorHandler = {
  conditionAdd: () => {
    const conditions = conditionsOf()
    const id = localId('condition')
    const filter = newFilter(id)
    conditions.push({
      id,
      color: getThemeV3RandomColor(conditions.length),
      conditions: [filter],
      nestedConditions: [filter],
      is_set_as_background: false,
      type: 'row',
      nc_order: conditions.length + 1,
    })
  },
  conditionUpdate: (params: {
    index: number
    color: string
    is_set_as_background: boolean
    nc_order?: number
    type?: string
    fk_target_column_id?: string
  }) => {
    const condition = conditionsOf()[params.index]
    if (!condition) return
    condition.color = params.color
    condition.is_set_as_background = params.is_set_as_background
    if (params.type !== undefined) condition.type = params.type
    if (params.fk_target_column_id !== undefined) condition.fk_target_column_id = params.fk_target_column_id
    if (condition.type === 'cell' && !condition.fk_target_column_id) condition.fk_target_column_id = columns.value[0]?.id
  },
  conditionDelete: (index: number) => {
    conditionsOf().splice(index, 1)
  },
  conditionCopy: (index: number) => {
    const source = conditionsOf()[index]
    if (!source) return
    const id = localId('condition')
    const nested = source.nestedConditions.map((f) => cloneFilter(f, id))
    const flatten = (list: FilterType[]): FilterType[] => list.flatMap((f) => [f, ...flatten(f.children ?? [])])
    conditionsOf().push({
      ...source,
      id,
      conditions: flatten(nested),
      nestedConditions: nested,
      nc_order: conditionsOf().length + 1,
    })
  },
  allConditionDeleted: () => {
    conditionsOf().splice(0)
  },
  filters: {
    addFilter: async (index: number, event: FilterGroupChangeEvent) => {
      const condition = conditionsOf()[index]
      if (!condition) return
      const filter = newFilter(condition.id, {
        tmp_id: event.tmp_id,
        fk_parent_id: event.fk_parent_id,
        logical_op: condition.conditions[0]?.logical_op ?? 'and',
        order: condition.conditions.length + 1,
      })
      attachFilter(condition, filter, event)
    },
    addFilterGroup: async (index: number, event: FilterGroupChangeEvent) => {
      const condition = conditionsOf()[index]
      if (!condition) return
      const group: FilterType = {
        id: localId('group'),
        tmp_id: event.tmp_id,
        fk_row_color_condition_id: condition.id,
        fk_parent_id: event.fk_parent_id,
        is_group: true,
        children: [],
        logical_op: condition.conditions[0]?.logical_op ?? 'and',
        order: condition.conditions.length + 1,
      }
      attachFilter(condition, group, event)
    },
    deleteFilter: async (index: number, event: FilterGroupChangeEvent) => {
      const condition = conditionsOf()[index]
      const id = event.filter?.id
      if (!condition || !id) return
      condition.conditions = condition.conditions.filter((f) => f.id !== id)
      dropFilter(condition.nestedConditions, id)
    },
    rowChange: async (index: number, event: FilterRowChangeEvent) => {
      const condition = conditionsOf()[index]
      const filter = condition?.conditions.find((f) => f.id === event.filter?.id)
      if (!condition || !filter) return
      ;(filter as Record<string, unknown>)[event.type] = event.value
      if (event.type === 'logical_op') {
        for (const sibling of condition.conditions) {
          if (sibling.fk_parent_id === filter.fk_parent_id) sibling.logical_op = event.value
        }
      }
      if (event.type === 'fk_column_id') {
        const column = columns.value.find((c) => c.id === event.value)
        adjustFilterWhenColumnChange({ column, filter, showNullAndEmptyInFilter: false })
      }
    },
    copyFilter: async (index: number, event: FilterRowChangeEvent) => {
      const condition = conditionsOf()[index]
      if (!condition || !event.filter) return
      const copy = cloneFilter(event.filter, condition.id)
      attachFilter(condition, copy, { fk_parent_id: event.filter.fk_parent_id } as FilterGroupChangeEvent)
    },
  },
}

onMounted(async () => {
  const setup = await mockSetupInit()
  rootMeta.value = setup.meta
})
</script>

<template>
  <MockInjection>
    <PgPage
      title="Row colour toolbar"
      description="The panels behind Toolbar → Row colour: condition-based colouring, single-select colouring and the mode picker that switches between them."
      :sections="SECTIONS"
    >
      <PgSection
        id="filter-panel"
        title="Using filter panel"
        source="SmartsheetToolbarRowColorFilterUsingFilterPanel"
        description="Colour rows by conditions. Runs on mock table metadata."
      >
        <PgDemo label="Props">
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
              <label v-for="prop in BOOLEAN_PROPS" :key="prop" class="flex items-center gap-2 cursor-pointer">
                <NcSwitch v-model:checked="options1[prop]" size="small" />
                <span class="text-captionSm text-nc-content-gray font-mono">{{ prop }}</span>
              </label>
            </div>
            <div class="grid grid-cols-2 gap-3 pt-4 border-t-1 border-nc-border-gray-light">
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">dbClientType</span>
                <NcSelect v-model:value="options1.dbClientType">
                  <a-select-option v-for="client in Object.values(ClientType)" :key="client" :value="client">
                    {{ client }}
                  </a-select-option>
                </NcSelect>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">filterPerViewLimit</span>
                <a-input-number v-model:value="options1.filterPerViewLimit" :min="0" class="!w-full !rounded-lg" />
              </div>
            </div>
          </div>
        </PgDemo>

        <PgDemo label="Panel">
          <SmartsheetToolbarRowColorFilterUsingFilterPanel
            v-model="vModel"
            :columns="columns"
            :target-field-columns="columns"
            :handler="rowColorHandler"
            :filter-per-view-limit="options1.filterPerViewLimit"
            :disabled="options1.disabled"
            :is-locked-view="options1.isLockedView"
            :db-client-type="options1.dbClientType"
          />
        </PgDemo>

        <PgDemo label="Events" hint="v-model">
          <pre
            class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-lg p-3 overflow-auto max-h-48 !m-0"
            >{{ JSON.stringify(vModel, null, 2) }}</pre
          >
        </PgDemo>
      </PgSection>

      <PgSection
        id="single-select-panel"
        title="Using single select"
        source="SmartsheetToolbarRowColorFilterUsingSingleSelectPanel"
        description="Colour rows by a single-select field's option colours."
      >
        <PgDemo label="Panel">
          <SmartsheetToolbarRowColorFilterUsingSingleSelectPanel
            v-model="selectVModel"
            :columns="SELECT_COLUMNS"
            @remove="removeClicked++"
          />
        </PgDemo>

        <PgDemo label="Events" :hint="`@remove fired ${removeClicked} times`">
          <pre
            class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-lg p-3 overflow-auto max-h-48 !m-0"
            >{{ JSON.stringify(selectVModel, null, 2) }}</pre
          >
        </PgDemo>
      </PgSection>

      <PgSection
        id="type-option"
        title="Mode picker"
        source="SmartsheetToolbarRowColorFilterTypeOption"
        description="Empty state that picks between the two modes, then renders the #filter or #select slot."
      >
        <PgDemo label="Picker" :hint="`rowColoringMode: ${rowColoringMode ?? 'null'}`">
          <template #actions>
            <NcButton type="secondary" size="xsmall" :disabled="!rowColoringMode" class="!px-2" @click="rowColoringMode = null">
              {{ $t('general.reset') }}
            </NcButton>
          </template>
          <SmartsheetToolbarRowColorFilterTypeOption v-model:row-coloring-mode="rowColoringMode" :columns="SELECT_COLUMNS">
            <template #filter>
              <div class="p-3 rounded-lg bg-nc-bg-gray-extralight text-captionSm text-nc-content-gray-subtle">
                #filter slot renders here
              </div>
            </template>
            <template #select>
              <div class="p-3 rounded-lg bg-nc-bg-gray-extralight text-captionSm text-nc-content-gray-subtle">
                #select slot renders here
              </div>
            </template>
          </SmartsheetToolbarRowColorFilterTypeOption>
        </PgDemo>
      </PgSection>
    </PgPage>
  </MockInjection>
</template>
