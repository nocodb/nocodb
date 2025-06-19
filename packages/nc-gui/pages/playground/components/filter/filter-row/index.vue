<script lang="ts" setup>
import { type ColumnType, UITypes } from 'nocodb-sdk'

const columns: ColumnType[] = [
  {
    id: 'col1',
    uidt: UITypes.SingleLineText,
  },
  {
    id: 'col2',
    uidt: UITypes.Decimal,
  },
  {
    id: 'col3',
    uidt: UITypes.Number,
  },
  {
    id: 'col4',
    uidt: UITypes.Links,
  },
  {
    id: 'col5',
    uidt: UITypes.DateTime,
    meta: {
      dateFormat: 'YY/MM/DD',
    },
  },
  {
    id: 'col-date-monthonly',
    uidt: UITypes.Date,
    meta: {
      dateFormat: 'YY-MM',
    },
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

const changeTimes1 = ref(0)
const options1 = ref({
  disabled: false,
  index: 0,
})
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
        </div>
        <div class="flex gap-2">
          <div class="flex flex-col gap-2">
            <div><NcSwitch v-model:checked="options1.disabled">disabled</NcSwitch><br /></div>
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
        :comparison-ops="comparisonOpList(column1?.uidt)"
        :comparison-sub-ops="[]"
        :disabled="options1.disabled"
        :show-null-and-empty-in-filter="true"
      />
    </div>
  </div>
</template>
