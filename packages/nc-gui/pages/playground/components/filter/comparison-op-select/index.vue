<script lang="ts" setup>
import { type ColumnType, UITypes } from 'nocodb-sdk'
import { SmartsheetToolbarFilterComparisonOpSelect } from '#components'

const filter1 = ref({
  fk_column_id: 'col1',
  comparison_op: 'eq',
})
const columnSingleLineText = {
  id: 'col1',
  uidt: UITypes.SingleLineText,
} as ColumnType

const changeTimes1 = ref(0)

const filter2 = ref({
  fk_column_id: 'col2',
  comparison_op: 'eq',
})
const columnSingleLineText2 = {
  id: 'col2',
  uidt: UITypes.SingleLineText,
} as ColumnType

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
        :column="columnSingleLineText"
        :uidt="columnSingleLineText.uidt"
        :link="false"
        :web-hook="false"
        :is-locked-view="false"
        :read-only="false"
        :show-null-and-empty-in-filter="true"
        @change="() => changeTimes1++"
      />
    </div>

    <a-card>
      <h4>Options</h4>

      <div>Selected comparisonOp: {{ filter1.comparison_op }}</div>
      <div>Times changed: {{ changeTimes1 }}</div>
      <div>
        <NcSwitch v-model:checked="options2.link">link</NcSwitch><br />
        <NcSwitch v-model:checked="options2.webHook">webHook</NcSwitch><br />
        <NcSwitch v-model:checked="options2.isLockedView">isLockedView</NcSwitch><br />
        <NcSwitch v-model:checked="options2.isReadOnly">isReadOnly</NcSwitch><br />
        <NcSwitch v-model:checked="options2.isShowNullAndEmptyInFilter">isShowNullAndEmptyInFilter</NcSwitch>
      </div>
    </a-card>
    <div class="p-4">
      <SmartsheetToolbarFilterComparisonOpSelect
        v-model="filter2.comparison_op"
        :filter="filter2"
        :column="columnSingleLineText2"
        :uidt="columnSingleLineText2.uidt"
        :link="options2.link"
        :web-hook="options2.webHook"
        :is-locked-view="options2.isLockedView"
        :read-only="options2.isReadOnly"
        :show-null-and-empty-in-filter="options2.isShowNullAndEmptyInFilter"
        @change="() => changeTimes2++"
      />
    </div>
  </div>
</template>
