<script lang="ts" setup>
import { type ColumnType, UITypes } from 'nocodb-sdk'
import { SmartsheetToolbarFilterComparisonOpSelect } from '#components'

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
  fk_column_id: 'col1',
  comparison_op: 'eq',
})

const changeTimes1 = ref(0)

const filter2 = ref({
  fk_column_id: 'col2',
  comparison_op: 'eq',
  comparison_sub_op: undefined,
})
const column2Id = ref(columns[0]!.id)
const column2 = computed(() => {
  return columns.find((col) => col.id === column2Id.value)
})

const changeTimes2 = ref(0)
const options2 = ref({
  link: false,
  webHook: false,
  isLockedView: false,
  isReadOnly: false,
  isShowNullAndEmptyInFilter: false,
})
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>

      <div>Selected comparisonOp: {{ filter1.comparison_op }}</div>
      <div>Times changed: {{ changeTimes1 }}</div>
    </a-card>
    <div class="p-4">
      <SmartsheetToolbarFilterComparisonOpSelect
        v-model="filter1.comparison_op"
        :filter="filter1"
        :column="columns[0]!"
        :uidt="columns[0]!.uidt"
        :link="false"
        :web-hook="false"
        :is-locked-view="false"
        :read-only="false"
        :show-null-and-empty-in-filter="true"
        @change="() => changeTimes1++"
      />
      <SmartsheetToolbarFilterComparisonSubOpSelect
        v-model="filter1.comparison_sub_op"
        :filter="filter1"
        :column="columns[0]!"
        :uidt="columns[0]!.uidt"
        :link="false"
        :web-hook="false"
        :is-locked-view="false"
        :read-only="false"
        @change="() => changeTimes1++"
      />
    </div>

    <a-card>
      <h4>Options</h4>

      <div>Selected comparisonOp: {{ filter2.comparison_op }}</div>
      <div>Times changed: {{ changeTimes2 }}</div>
      <div class="flex">
        <div>
          <NcSwitch v-model:checked="options2.link">link</NcSwitch><br />
          <NcSwitch v-model:checked="options2.webHook">webHook</NcSwitch><br />
          <NcSwitch v-model:checked="options2.isLockedView">isLockedView</NcSwitch><br />
          <NcSwitch v-model:checked="options2.isReadOnly">isReadOnly</NcSwitch><br />
          <NcSwitch v-model:checked="options2.isShowNullAndEmptyInFilter">isShowNullAndEmptyInFilter</NcSwitch>
        </div>
        <div class="flex">
          <NcSelect v-model:value="column2Id" @change="filter2.fk_column_id = column2Id">
            <a-select-option v-for="col of columns" :key="col.id" :value="col.id">
              {{ col.id }} - {{ col.uidt }}
            </a-select-option>
          </NcSelect>
          <div class="w-[300px] overflow-wrap">
            {{ column2 }}
          </div>
        </div>
      </div>
    </a-card>
    <div class="p-4">
      <SmartsheetToolbarFilterComparisonOpSelect
        v-model="filter2.comparison_op"
        :filter="filter2"
        :column="column2!"
        :uidt="column2?.uidt"
        :link="options2?.link"
        :web-hook="options2.webHook"
        :is-locked-view="options2.isLockedView"
        :read-only="options2.isReadOnly"
        :show-null-and-empty-in-filter="options2.isShowNullAndEmptyInFilter"
        @change="() => changeTimes2++"
      />
      <SmartsheetToolbarFilterComparisonSubOpSelect
        v-model="filter2.comparison_sub_op"
        :filter="filter2"
        :column="column2!"
        :uidt="column2?.uidt"
        :link="options2?.link"
        :web-hook="options2.webHook"
        :is-locked-view="options2.isLockedView"
        :read-only="options2.isReadOnly"
        @change="() => changeTimes2++"
      />
    </div>
  </div>
</template>
