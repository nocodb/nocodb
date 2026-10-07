<script lang="ts" setup>
import { ClientType } from 'nocodb-sdk'
import PgDemo from '../../../-components/PgDemo.vue'
import PgPage from '../../../-components/PgPage.vue'
import PgSection from '../../../-components/PgSection.vue'
import { defaultColumns } from '../../../-helper/columns'
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
  'webHook',
  'link',
  'parentEnabled',
] as const

const columns = defaultColumns

// without a handler FilterRow writes each change straight into the filter it is given
const filter = ref<ColumnFilterType>({
  fk_column_id: columns[0]!.id,
  comparison_op: 'eq',
  comparison_sub_op: null,
  logical_op: 'and',
})

const options = ref({
  index: 0,
  disabled: false,
  isLogicalOpChangeAllowed: false,
  isLockedView: false,
  showNullAndEmptyInFilter: false,
  webHook: false,
  link: false,
  // a boolean prop, so leaving it off reads as false and greys the row out
  parentEnabled: true,
  dbClientType: ClientType.PG,
})

const isFieldInaccessible = ref(true)

const lastChangeEvent = ref({})

const lastDeleteEvent = ref({})

const deleteCount = ref(0)

const copyCount = ref(0)

function onDelete(event: { filter: ColumnFilterType; index: number }) {
  lastDeleteEvent.value = event
  deleteCount.value++
}
</script>

<template>
  <MockInjection>
    <PgPage
      title="Filter row"
      description="SmartsheetToolbarFilterRow on its own: one condition with logical op, field, operator, sub-operator and value. The knobs drive all three demos, which share one filter."
      :sections="SECTIONS"
    >
      <PgSection id="props" title="Props & events" source="SmartsheetToolbarFilterRow">
        <PgDemo label="Props">
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
              <label v-for="prop in BOOLEAN_PROPS" :key="prop" class="flex items-center gap-2 cursor-pointer">
                <NcSwitch v-model:checked="options[prop]" size="small" />
                <span class="text-captionSm text-nc-content-gray font-mono">{{ prop }}</span>
              </label>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t-1 border-nc-border-gray-light">
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">dbClientType</span>
                <NcSelect v-model:value="options.dbClientType">
                  <a-select-option v-for="client in Object.values(ClientType)" :key="client" :value="client">
                    {{ client }}
                  </a-select-option>
                </NcSelect>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">index</span>
                <a-input-number v-model:value="options.index" :min="0" class="!w-full !rounded-lg" />
              </div>
            </div>
          </div>
        </PgDemo>

        <PgDemo label="Events" :hint="`@delete fired ${deleteCount} times · @copy fired ${copyCount} times`">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-captionXs text-nc-content-gray-muted font-mono">v-model</span>
              <pre
                class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-lg p-3 overflow-auto max-h-48 !m-0"
                >{{ JSON.stringify(filter, null, 2) }}</pre
              >
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-captionXs text-nc-content-gray-muted font-mono">change</span>
              <pre
                class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-lg p-3 overflow-auto max-h-48 !m-0"
                >{{ JSON.stringify(lastChangeEvent, null, 2) }}</pre
              >
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-captionXs text-nc-content-gray-muted font-mono">delete</span>
              <pre
                class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-lg p-3 overflow-auto max-h-48 !m-0"
                >{{ JSON.stringify(lastDeleteEvent, null, 2) }}</pre
              >
            </div>
          </div>
        </PgDemo>
      </PgSection>

      <PgSection id="demos" title="Demos">
        <PgDemo label="Default">
          <SmartsheetToolbarFilterRow
            :model-value="filter"
            :index="options.index"
            :columns="columns"
            :show-null-and-empty-in-filter="options.showNullAndEmptyInFilter"
            :disabled="options.disabled"
            :is-logical-op-change-allowed="options.isLogicalOpChangeAllowed"
            :is-locked-view="options.isLockedView"
            :db-client-type="options.dbClientType"
            :web-hook="options.webHook"
            :link="options.link"
            :parent-enabled="options.parentEnabled"
            @change="lastChangeEvent = $event"
            @delete="onDelete"
            @copy="copyCount++"
          />
        </PgDemo>

        <PgDemo label="Part props" hint="containerProps, logicalOpsProps, columnSelectProps, … outline each part">
          <SmartsheetToolbarFilterRow
            :model-value="filter"
            :index="options.index"
            :columns="columns"
            :show-null-and-empty-in-filter="options.showNullAndEmptyInFilter"
            :disabled="options.disabled"
            :is-logical-op-change-allowed="options.isLogicalOpChangeAllowed"
            :is-locked-view="options.isLockedView"
            :db-client-type="options.dbClientType"
            :web-hook="options.webHook"
            :link="options.link"
            :parent-enabled="options.parentEnabled"
            :container-props="{ class: ['!bg-nc-bg-gray-extralight', 'rounded-lg', 'p-1'] }"
            :logical-ops-props="{ class: ['!ring-2', '!ring-inset', '!ring-orange-500'] }"
            :column-select-props="{ class: ['!ring-2', '!ring-purple-500', 'relative', 'z-1'] }"
            :comparison-ops-props="{ class: ['!ring-2', '!ring-green-500', 'relative', 'z-1'] }"
            :comparison-sub-ops-props="{ class: ['!ring-2', '!ring-green-500', 'relative', 'z-1'] }"
            :input-value-props="{ class: ['!ring-2', '!ring-inset', '!ring-brand-500'] }"
            :delete-button-props="{ class: ['!ring-2', '!ring-inset', '!ring-red-500'] }"
            @change="lastChangeEvent = $event"
            @delete="onDelete"
            @copy="copyCount++"
          />
        </PgDemo>

        <PgDemo label="#fieldInaccessibleError slot">
          <template #actions>
            <label class="flex items-center gap-2 cursor-pointer">
              <NcSwitch v-model:checked="isFieldInaccessible" size="small" />
              <span class="text-captionSm text-nc-content-gray">Field inaccessible</span>
            </label>
          </template>
          <SmartsheetToolbarFilterRow
            :model-value="filter"
            :index="options.index"
            :columns="columns"
            :show-null-and-empty-in-filter="options.showNullAndEmptyInFilter"
            :disabled="options.disabled"
            :is-logical-op-change-allowed="options.isLogicalOpChangeAllowed"
            :is-locked-view="options.isLockedView"
            :db-client-type="options.dbClientType"
            :web-hook="options.webHook"
            :link="options.link"
            :parent-enabled="options.parentEnabled"
            @change="lastChangeEvent = $event"
            @delete="onDelete"
            @copy="copyCount++"
          >
            <template v-if="isFieldInaccessible" #fieldInaccessibleError>
              <NcTooltip class="flex-1 flex items-center gap-2 px-2 !text-nc-content-red-medium cursor-pointer">
                <template #title>The field this filter uses was deleted or hidden from you</template>
                <GeneralIcon icon="alertTriangle" class="flex-none" />
                {{ $t('title.fieldInaccessible') }}
              </NcTooltip>
            </template>
          </SmartsheetToolbarFilterRow>
        </PgDemo>
      </PgSection>
    </PgPage>
  </MockInjection>
</template>
