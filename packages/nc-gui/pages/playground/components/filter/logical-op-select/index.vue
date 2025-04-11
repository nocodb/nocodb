<script lang="ts" setup>
const filter1 = ref({
  fk_column_id: 'col1',
  comparison_op: 'eq',
  logical_op: 'and',
})

const changeTimes1 = ref(0)
const options1 = ref({
  link: false,
  webHook: false,
  isLockedView: false,
  isReadOnly: false,
  isLogicalOpChangeAllowed: false,
})
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>

      <div>Selected logicalOp: {{ filter1.logical_op }}</div>
      <div>Times changed: {{ changeTimes1 }}</div>
      <div class="flex">
        <div>
          <NcSwitch v-model:checked="options1.link">link</NcSwitch><br />
          <NcSwitch v-model:checked="options1.webHook">webHook</NcSwitch><br />
          <NcSwitch v-model:checked="options1.isLockedView">isLockedView</NcSwitch><br />
          <NcSwitch v-model:checked="options1.isReadOnly">isReadOnly</NcSwitch><br />
          <NcSwitch v-model:checked="options1.isLogicalOpChangeAllowed">isLogicalOpChangeAllowed</NcSwitch>
        </div>
        <div class="flex"></div>
      </div>
    </a-card>
    <div class="p-4">
      <SmartsheetToolbarFilterLogicalOpSelect
        v-model="filter1.logical_op"
        :filter="filter1"
        :link="options1.link"
        :web-hook="options1.webHook"
        :is-locked-view="options1.isLockedView"
        :read-only="options1.isReadOnly"
        :is-logical-op-change-allowed="options1.isLogicalOpChangeAllowed"
        @change="() => changeTimes1++"
      />
    </div>
  </div>
</template>
