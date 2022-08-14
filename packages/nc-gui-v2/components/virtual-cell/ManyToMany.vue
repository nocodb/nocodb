<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import ItemChip from './components/ItemChip.vue'
import ListChildItems from './components/ListChildItems.vue'
import ListItems from './components/ListItems.vue'
import { computed, inject, ref, useProvideLTARStore, useSmartsheetRowStoreOrThrow } from '#imports'
import { CellValueInj, ColumnInj, EditModeInj, IsFormInj, ReloadViewDataHookInj, RowInj } from '~/context'

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const cellValue = inject(CellValueInj)!

const reloadTrigger = inject(ReloadViewDataHookInj)!

const isForm = inject(IsFormInj)

const editEnabled = inject(EditModeInj)

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()
const { loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadTrigger.trigger,
)

await loadRelatedTableMeta()

const localCellValue = computed(() => {
  if (cellValue?.value) {
    return cellValue?.value
  } else if (isNew.value) {
    return state?.value?.[column?.value.title as string]
  }
  return []
})

const cells = computed(() =>
  localCellValue.value.reduce((acc: any[], curr: any) => {
    if (!relatedTablePrimaryValueProp.value) return acc

    const value = curr[relatedTablePrimaryValueProp.value]

    if (!value) return acc

    return [...acc, { value, item: curr }]
  }, [] as any[]),
)

const unlinkRef = async (rec: Record<string, any>) => {
  if (isNew.value) {
    removeLTARRef(rec, column?.value as ColumnType)
  } else {
    await unlink(rec)
  }
}
</script>

<template>
  <div class="flex align-center gap-1 w-full h-full chips-wrapper">
    <template v-if="!isForm">
      <div class="chips flex align-center img-container flex-grow hm-items flex-nowrap min-w-0 overflow-hidden">
        <template v-if="cells">
          <ItemChip v-for="(cell, i) of cells" :key="i" :item="cell.item" :value="cell.value" @unlink="unlinkRef(cell.item)" />

          <span v-if="cells?.length === 10" class="caption pointer ml-1 grey--text" @click="childListDlg = true">more... </span>
        </template>
      </div>

      <div class="flex-1 flex justify-end gap-1 min-h-[30px] align-center">
        <MdiArrowExpand class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500" @click="childListDlg = true" />

        <MdiPlus
          v-if="editEnabled"
          class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500"
          @click="listItemsDlg = true"
        />
      </div>
    </template>

    <ListItems v-model="listItemsDlg" />

    <ListChildItems
      v-model="childListDlg"
      @attach-record="
        () => {
          childListDlg = false
          listItemsDlg = true
        }
      "
    />
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
