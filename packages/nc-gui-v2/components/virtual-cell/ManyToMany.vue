<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import ItemChip from './components/ItemChip.vue'
import ListChildItems from './components/ListChildItems.vue'
import ListItems from './components/ListItems.vue'
import { inject, ref, useProvideLTARStore } from '#imports'
import { CellValueInj, ColumnInj, ReloadViewDataHookInj, RowInj } from '~/context'

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const cellValue = inject(CellValueInj)!

const reloadTrigger = inject(ReloadViewDataHookInj)!

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  reloadTrigger.trigger,
)

await loadRelatedTableMeta()
</script>

<template>
  <div class="flex align-center gap-1 w-full h-full chips-wrapper">
    <!--    <template v-if="!isForm"> -->
    <div class="chips flex align-center img-container flex-grow hm-items flex-nowrap min-w-0 overflow-hidden">
      <template v-if="cellValue">
        <ItemChip v-for="(ch, i) in cellValue" :key="i" :value="ch[relatedTablePrimaryValueProp]" @unlink="unlink(ch)" />

        <span v-if="cellValue?.length === 10" class="caption pointer ml-1 grey--text" @click="childListDlg = true">more... </span>
      </template>
    </div>
    <div class="flex-1 flex justify-end gap-1 min-h-[30px] align-center">
      <MdiArrowExpand class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500" @click="childListDlg = true" />
      <MdiPlus class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500" @click="listItemsDlg = true" />
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
  @apply inline-block;
}
</style>
