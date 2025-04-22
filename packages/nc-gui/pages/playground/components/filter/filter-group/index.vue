<script lang="ts" setup>
import { mockSetupInit } from '../../../-helper/mock-setup'
import MockInjection from '../../MockInjection.vue'
const { metas } = useMetas()
const defaultTableId = 'mtWA9ZXvsuh'

const rootMeta = ref({})
const columns = computedAsync(async () => {
  if (!metas.value || Object.keys(metas.value).length === 0) return []
  return await composeColumnsForFilter({ rootMeta: rootMeta.value, getMeta: async (id) => metas.value[id] })
})
const filters = ref([])
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
})
const lastChangeEvent1 = ref({})
const lastRowChangeEvent1 = ref({})
const column1Id = ref(columns.value?.[0]?.id)
const column1 = computed(() => {
  return columns.value?.find((col) => col.id === column1Id.value)
})

const onChange = (event) => {
  lastChangeEvent1.value = event
}
const onRowChange = (event) => {
  lastRowChangeEvent1.value = event
}
onMounted(async () => {
  await mockSetupInit()
  rootMeta.value = metas.value[defaultTableId]
})
</script>

<template>
  <MockInjection>
    <div class="bg-gray-100 pb-8 overflow-y-auto">
      <a-card>
        <h4>Simple</h4>

        <div class="flex gap-4">
          <div class="flex flex-col gap-2">
            <div><NcSwitch v-model:checked="options1.disabled">disabled</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.isLogicalOpChangeAllowed">isLogicalOpChangeAllowed</NcSwitch><br /></div>
            <div><NcSwitch v-model:checked="options1.isLockedView">isLockedView</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.showNullAndEmptyInFilter">showNullAndEmptyInFilter</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.isFullWidth">isFullWidth</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.webHook">webHook</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.link">link</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.isForm">isForm</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.isPublic">isPublic</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.queryFilter">queryFilter</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.disableAddNewFilter">disableAddNewFilter</NcSwitch></div>
          </div>
          <div class="flex-col gap-2">
            <div class="flex-col space-y-2">
              <div>dbClientType: <NcSelect v-model:value="options1.dbClientType"></NcSelect></div>
              <div>
                actionBtnType:
                <NcSelect v-model:value="options1.actionBtnType">
                  <a-select-option value="text"> Text </a-select-option>
                  <a-select-option value="secondary"> Secondary </a-select-option>
                </NcSelect>
              </div>

              <div>Index: <input v-model="options1.index" type="number" class="text-xs p-1 border-gray-200" /><br /></div>
              <div>
                NestedLevel: <input v-model="options1.nestedLevel" type="number" class="text-xs p-1 border-gray-200" /><br />
              </div>
              <div>
                filterPerViewLimit:
                <input v-model="options1.filterPerViewLimit" type="number" class="text-xs p-1 border-gray-200" /><br />
              </div>
              <div>
                filtersCount: <input v-model="options1.filtersCount" type="number" class="text-xs p-1 border-gray-200" /><br />
              </div>
            </div>
          </div>
          <div class="flex-col flex-grow space-y-2">
            Last event:
            <div class="min-w-[300px] max-h-[200px] overflow-wrap bg-gray-300 overflow-y-scroll">
              <pre>{{ JSON.stringify(lastRowChangeEvent1, null, 2) }}</pre>
            </div>
            <div class="min-w-[300px] max-h-[200px] overflow-wrap bg-gray-300 overflow-y-scroll">
              <pre>{{ JSON.stringify(lastChangeEvent1, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </a-card>
      <div class="p-4">
        <SmartsheetToolbarFilterGroup
          v-model="filters"
          :index="options1.index"
          :nested-level="options1.nestedLevel"
          :columns="columns"
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
          @change="onChange"
          @row-change="onRowChange"
        />
      </div>
      <a-card>
        <h4>Custom toolbar (root only)</h4>
      </a-card>
      <div class="p-4">
        <SmartsheetToolbarFilterGroup
          v-model="filters"
          :index="options1.index"
          :nested-level="options1.nestedLevel"
          :columns="columns"
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
          @change="onChange"
          @row-change="onRowChange"
        >
          <template #root-header>
            <div>Hello</div>
          </template>
        </SmartsheetToolbarFilterGroup>
      </div>
    </div>
  </MockInjection>
</template>
