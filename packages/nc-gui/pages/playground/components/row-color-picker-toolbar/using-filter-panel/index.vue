<script lang="ts" setup>
import { mockSetupInit } from '../../../-helper/mock-setup'
import MockInjection from '../../MockInjection.vue'

const vModel = ref([])
const rootMeta = ref({})
const { metas } = useMetas()
const defaultTableId = 'mtWA9ZXvsuh'
const columns = computedAsync(async () => {
  if (!metas.value || Object.keys(metas.value).length === 0) return []
  return await composeColumnsForFilter({ rootMeta: rootMeta.value, getMeta: async (id) => metas.value[id] })
})
const options1 = ref({
  filtersCount: 0,
  filterPerViewLimit: 5,
  disabled: false,
  isLockedView: false,
  disableAddNewFilter: false,
  dbClientType: ClientType.PG,
})
onMounted(async () => {
  await mockSetupInit()
  rootMeta.value = metas.value[defaultTableId]
})
</script>

<template>
  <MockInjection>
    <div class="bg-gray-100 overflow-auto pb-8">
      <a-card>
        <h4>Simple</h4>
        <div class="flex gap-4">
          <div class="flex flex-col gap-2">
            <div><NcSwitch v-model:checked="options1.disabled">disabled</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.isLockedView">isLockedView</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.disableAddNewFilter">disableAddNewFilter</NcSwitch></div>
          </div>
          <div class="flex-col gap-2">
            <div class="flex-col space-y-2">
              <div>
                dbClientType:
                <NcSelect v-model:value="options1.dbClientType">
                  <a-select-option value="PG">PG</a-select-option>
                  <a-select-option value="MYSQL">mysql</a-select-option>
                  <a-select-option value="SQLITE">sqlite</a-select-option>
                </NcSelect>
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
            vModel:
            <div class="min-w-[300px] max-h-[200px] overflow-wrap bg-gray-300 overflow-y-scroll">
              <pre>{{ JSON.stringify(vModel, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </a-card>
      <div class="m-4">
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
      </div>
    </div>
  </MockInjection>
</template>
