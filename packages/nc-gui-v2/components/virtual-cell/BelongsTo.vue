<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import ItemChip from './components/ItemChip.vue'
import ListItems from './components/ListItems.vue'
import { useSmartsheetRowStoreOrThrow } from '~/composables/useSmartsheetRowStore'
import { useProvideLTARStore } from '#imports'
import { CellValueInj, ColumnInj, IsFormInj, ReloadViewDataHookInj, RowInj } from '~/context'
import { inject, ref, useProvideLTARStore } from '#imports'
import { CellValueInj,IsFormInj, ColumnInj, ReloadViewDataHookInj, RowInj } from '~/context'

const column = inject(ColumnInj)

const reloadTrigger = inject(ReloadViewDataHookInj)!

const cellValue = inject(CellValueInj, ref<any>(null))

const row = inject(RowInj)

const active = false

const listItemsDlg = ref(false)

const isForm = inject(IsFormInj)

const { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  reloadTrigger.trigger,
)

await loadRelatedTableMeta()
const { state, isNew } = useSmartsheetRowStoreOrThrow()
const value = computed(() => {
  if (cellValue?.value) {
    return cellValue?.value
  } else if (isNew.value) {
    return state?.value?.[column?.value.title as string]
  }
  return null
})
</script>

<template>
  <div class="flex w-full chips-wrapper align-center" :class="{ active }">
    <div class="chips d-flex align-center flex-grow">
      <template v-if="value">
        <ItemChip :item="value" :value="cellValue[relatedTablePrimaryValueProp]" @unlink="unlink(value)" />
      </template>
    </div>
    <div class="flex-1 flex justify-end gap-1 min-h-[30px] align-center">
      <MdiArrowExpand
        class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 select-none group-hover:(text-gray-500)"
        @click="listItemsDlg = true"
      />
    </div>
    <ListItems v-model="listItemsDlg" @attach-record="listItemsDlg = true" />
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
