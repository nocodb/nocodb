<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import ListItems from './components/ListItems.vue'
import { useProvideLTARStore } from '#imports'
import { CellValueInj, ColumnInj, IsFormInj, ReloadViewDataHookInj, RowInj } from '~/context'
import MdiExpandIcon from '~icons/mdi/arrow-expand'

const column = inject(ColumnInj)
const reloadTrigger = inject(ReloadViewDataHookInj)
const cellValue = inject(CellValueInj)
const row = inject(RowInj)
const active = false
const localState = null
const listItemsDlg = ref(false)
const isForm = inject(IsFormInj)

const { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Required<ColumnType>,
  row,
  () => reloadTrigger?.trigger(),
)
await loadRelatedTableMeta()
</script>

<template>
  <div class="flex w-full chips-wrapper align-center" :class="{ active }">
    <template v-if="!isForm">
    <div class="chips d-flex align-center flex-grow">
      <template v-if="cellValue || localState">
        <ItemChip :item="cellValue" :value="cellValue[relatedTablePrimaryValueProp]" @unlink="unlink(cellValue || localState)" />
      </template>
    </div>
    <div class="flex-1 flex justify-end gap-1">
      <MdiExpandIcon
        class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 select-none group-hover:(text-gray-500)"
        @click="listItemsDlg = true"
      />
    </div>
    </template>
    <ListChildItems />
    <ListItems v-model="listItemsDlg"  @attach-record=" (listItemsDlg = true)"/>
  </div>
</template>

<style scoped>
.nc-action-icon {
  @apply hidden cursor-pointer;
}

.chips-wrapper:hover .nc-action-icon {
  @apply inline-block;
}
</style>
