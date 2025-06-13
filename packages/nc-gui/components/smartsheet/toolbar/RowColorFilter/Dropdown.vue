<script setup lang="ts">
import {
  NcButton,
  NcDropdown,
  SmartsheetToolbarRowColorFilterTypeOption,
  SmartsheetToolbarRowColorFilterUsingSingleSelectPanel,
} from '#components'

const meta = inject(MetaInj, ref())
const activeView = inject(ActiveViewInj, ref())

const { rowColorInfo } = useViewRowColorOption({
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
const onRemoveRowColoringMode = () => {
  rowColorInfo.value.mode = null
}
</script>

<template>
  <NcDropdown :auto-close="false">
    <NcButton> Coloring </NcButton>
    <template #overlay>
      <SmartsheetToolbarRowColorFilterTypeOption v-model:row-coloring-mode="rowColoringMode">
        <template #select>
          <SmartsheetToolbarRowColorFilterUsingSingleSelectPanel
            v-model="rowColorInfo"
            :columns="meta?.columns"
            @remove="onRemoveRowColoringMode"
          />
        </template>
        <template #filter> FILTER </template>
      </SmartsheetToolbarRowColorFilterTypeOption>
    </template>
  </NcDropdown>
</template>
