<script lang="ts" setup>
import type { RowColoringMode } from 'nocodb-sdk'
import { ClientType } from 'nocodb-sdk'
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

const BOOLEAN_PROPS = ['disabled', 'isLockedView', 'disableAddNewFilter'] as const

const SELECT_COLUMNS = [
  { id: 'col_1', title: 'First Column' },
  { id: 'col_2', title: 'Second Column' },
]

const { metas } = useMetas()

const vModel = ref([])

const rootMeta = ref({})

const options1 = ref({
  filtersCount: 0,
  filterPerViewLimit: 5,
  disabled: false,
  isLockedView: false,
  disableAddNewFilter: false,
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
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t-1 border-nc-border-gray-light">
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">dbClientType</span>
                <NcSelect v-model:value="options1.dbClientType" size="small">
                  <a-select-option v-for="client in Object.values(ClientType)" :key="client" :value="client">
                    {{ client }}
                  </a-select-option>
                </NcSelect>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">filterPerViewLimit</span>
                <a-input-number v-model:value="options1.filterPerViewLimit" :min="0" size="small" class="!w-full !rounded-lg" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-captionXs text-nc-content-gray-muted font-mono">filtersCount</span>
                <a-input-number v-model:value="options1.filtersCount" :min="0" size="small" class="!w-full !rounded-lg" />
              </div>
            </div>
          </div>
        </PgDemo>

        <PgDemo label="Panel">
          <SmartsheetToolbarRowColorFilterUsingFilterPanel
            v-model="vModel"
            :columns="columns"
            :filters-count="options1.filtersCount"
            :filter-per-view-limit="options1.filterPerViewLimit"
            :disabled="options1.disabled"
            :is-locked-view="options1.isLockedView"
            :db-client-type="options1.dbClientType"
            :disable-add-new-filter="options1.disableAddNewFilter"
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
            <NcButton type="secondary" size="xsmall" :disabled="!rowColoringMode" @click="rowColoringMode = null">
              Reset
            </NcButton>
          </template>
          <SmartsheetToolbarRowColorFilterTypeOption v-model:row-coloring-mode="rowColoringMode">
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
