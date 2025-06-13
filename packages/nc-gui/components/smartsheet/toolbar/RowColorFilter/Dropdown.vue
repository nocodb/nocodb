<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())
const activeView = inject(ActiveViewInj, ref())

const { rowColorInfo, onDropdownOpen, onRemoveRowColoringMode } = useViewRowColorOption({
  meta,
  view: activeView,
})
const rowColoringMode = computed({
  set: (value) => {
    console.log(rowColorInfo.value, value)
    rowColorInfo.value.mode = value
  },
  get: () => {
    return rowColorInfo.value.mode
  },
})
</script>

<template>
  <NcDropdown @open="onDropdownOpen">
    <NcButton> Coloring </NcButton>
    <template #overlay>
      <SmartsheetToolbarRowColorFilterTypeOption v-model:row-coloring-mode="rowColoringMode">
        <template #select>
          <SmartsheetToolbarRowColorFilterUsingSingleSelectPanel
            v-model="rowColorInfo"
            @update:modelValue=""
            :columns="meta?.columns.filter((k) => k.uidt === UITypes.SingleSelect)"
            @remove="onRemoveRowColoringMode"
          />
        </template>
        <template #filter> FILTER </template>
      </SmartsheetToolbarRowColorFilterTypeOption>
    </template>
  </NcDropdown>
</template>
