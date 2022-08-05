<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import ItemChip from './components/ItemChip.vue'
import ListChildItems from './components/ListChildItems.vue'
import ListItems from './components/ListItems.vue'
import { useProvideLTARStore } from '#imports'
import { CellValueInj, ColumnInj, ReloadViewDataHookInj, RowInj } from '~/context'
import MdiExpandIcon from '~icons/mdi/arrow-expand'
import MdiPlusIcon from '~icons/mdi/plus'

const column = inject(ColumnInj)
const cellValue = inject(CellValueInj)
const row = inject(RowInj)
const reloadTrigger = inject(ReloadViewDataHookInj)

const listItemsDlg = ref(false)
const childListDlg = ref(false)

const { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  () => reloadTrigger?.trigger(),
)
await loadRelatedTableMeta()
</script>

<template>
  <div class="flex align-center gap-1 w-full min-full chips-wrapper">
    <div class="chips flex align-center img-container flex-grow hm-items flex-nowrap min-w-0 overflow-hidden">
      <template v-if="cellValue">
        <ItemChip v-for="(ch, i) in cellValue" :key="i" :value="ch[relatedTablePrimaryValueProp]" @unlink="unlink(ch)" />
        <span v-if="cellValue?.length === 10" class="caption pointer ml-1 grey--text" @click="childListDlg = true">more... </span>
      </template>
    </div>
    <div class="flex-grow flex justify-end gap-1">
      <MdiExpandIcon
        class="select-none transform text-sm nc-action-icon text-gray-500/50 hover:text-gray-500"
        @click="childListDlg = true"
      />
      <MdiPlusIcon class="select-none text-sm nc-action-icon text-gray-500/50 hover:text-gray-500" @click="listItemsDlg = true" />
    </div>
    <ListItems v-model="listItemsDlg" />
    <ListChildItems v-model="childListDlg" @attach-record=";(childListDlg = false), (listItemsDlg = true)" />
  </div>
</template>

<style scoped>
.nc-action-icon {
  @apply hidden cursor-pointer;
}

.chips-wrapper:hover .nc-action-icon {
  @apply flex;
}
</style>
