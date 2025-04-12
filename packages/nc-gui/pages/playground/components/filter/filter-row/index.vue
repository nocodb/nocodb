<script lang="ts" setup>
import { ClientType, type ColumnType, UITypes } from 'nocodb-sdk'

const columns: ColumnType[] = [
  {
    id: 'col1',
    uidt: UITypes.SingleLineText,
    title: 'Column 1',
    dt: 'text',
    order: 1,
  },
  {
    id: 'col2',
    uidt: UITypes.Decimal,
    title: 'Column 2',
    dt: 'decimal',
    order: 2,
  },
  {
    id: 'col3',
    uidt: UITypes.Number,
    title: 'Column 3',
    dt: 'bigint',
    dtx: 'specificType',
    meta: { isLocaleString: false },
    system: false,
    order: 5,
  },
  {
    id: 'col4',
    uidt: UITypes.Links,
    title: 'Column 4',
    order: 3,
  },
  {
    id: 'col5',
    uidt: UITypes.DateTime,
    meta: {
      dateFormat: 'YY/MM/DD',
    },
    title: 'Column 5',
    order: 4,
  },
  {
    id: 'col-date-monthonly',
    uidt: UITypes.Date,
    meta: {
      dateFormat: 'YY-MM',
    },
    title: 'Column 6',
    order: 6,
  },
]

const filter1 = ref({
  fk_column_id: columns[0]!.id,
  comparison_op: 'eq',
  comparison_sub_op: null,
  logical_op: 'and',
})
const column1Id = ref(columns[0]!.id)
const column1 = computed(() => {
  return columns.find((col) => col.id === column1Id.value)
})

const lastChangeEvent1 = ref({})
const options1 = ref({
  disabled: false,
  index: 0,
  isLockedView: false,
  isLogicalOpChangeAllowed: false,
  showNullAndEmptyInFilter: false,
  dbClientType: ClientType.PG,
})
const deleted1Times = ref(0)
const deleted1LastEvent = ref({})

const onFilter1Change = (event) => {
  lastChangeEvent1.value = event
  if (event.type === 'fk_column_id') {
    column1Id.value = event.value
  }
}
const onFilter1Delete = (event) => {
  deleted1LastEvent.value = event
  deleted1Times.value++
}
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <div class="flex flex-col gap-2">
        <h4>Simple</h4>

        <div class="flex">
          <span>Filter:</span>

          <div class="w-[300px] max-h-[100px] overflow-wrap bg-gray-300 overflow-y-scroll">
            {{ filter1 }}
          </div>

          <span>Last change event:</span>
          <div class="w-[300px] max-h-[100px] overflow-wrap bg-gray-300 overflow-y-scroll">
            {{ lastChangeEvent1 }}
          </div>
        </div>
        <div class="flex">
          <span>Delete: {{ deleted1Times }}</span>

          <div class="w-[300px] max-h-[100px] overflow-wrap bg-gray-300 overflow-y-scroll">
            {{ deleted1LastEvent }}
          </div>
        </div>
        <div class="flex gap-2">
          <div class="flex flex-col gap-2">
            <div><NcSwitch v-model:checked="options1.disabled">disabled</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.isLogicalOpChangeAllowed">isLogicalOpChangeAllowed</NcSwitch><br /></div>
            <div><NcSwitch v-model:checked="options1.isLockedView">isLockedView</NcSwitch></div>
            <div><NcSwitch v-model:checked="options1.showNullAndEmptyInFilter">showNullAndEmptyInFilter</NcSwitch></div>
            <div>dbClientType: <NcSelect v-model:value="options1.dbClientType"></NcSelect></div>
            <div>Index: <input v-model="options1.index" type="number" class="text-xs p-1 border-gray-200" /><br /></div>
          </div>
          <div class="flex">
            <NcSelect v-model:value="column1Id" @change="filter1.fk_column_id = column1Id">
              <a-select-option v-for="col of columns" :key="col.id" :value="col.id">
                {{ col.id }} - {{ col.uidt }}
              </a-select-option>
            </NcSelect>
            <div class="w-[300px] overflow-wrap">
              {{ column1 }}
            </div>
          </div>
        </div>
      </div>
    </a-card>
    <div class="p-4">
      <SmartsheetToolbarFilterRow
        :model-value="filter1"
        :index="options1.index"
        :columns="columns"
        :show-null-and-empty-in-filter="options1.showNullAndEmptyInFilter"
        :comparison-sub-ops="[]"
        :disabled="options1.disabled"
        :is-logical-op-change-allowed="options1.isLogicalOpChangeAllowed"
        :is-locked-view="options1.isLockedView"
        :db-client-type="options1.dbClientType"
        @change="onFilter1Change($event)"
        @delete="onFilter1Delete($event)"
      />
    </div>
  </div>
</template>
