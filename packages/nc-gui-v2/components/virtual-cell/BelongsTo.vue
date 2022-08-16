<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  ActiveCellInj,
  CellValueInj,
  ColumnInj,
  ReadonlyInj,
  ReloadViewDataHookInj,
  RowInj,
  defineAsyncComponent,
  inject,
  ref,
  useProvideLTARStore,
  useSmartsheetRowStoreOrThrow,
} from '#imports'
import MdiArrowExpand from '~icons/mdi/arrow-expand'
import MdiPlus from '~icons/mdi/plus'

const ItemChip = defineAsyncComponent(() => import('./components/ItemChip.vue'))

const ListItems = defineAsyncComponent(() => import('./components/ListItems.vue'))

const column = inject(ColumnInj)!

const reloadTrigger = inject(ReloadViewDataHookInj)!

const cellValue = inject(CellValueInj, ref<any>(null))

const row = inject(RowInj)!

const active = inject(ActiveCellInj)!

const readonly = inject(ReadonlyInj, false)

const listItemsDlg = ref(false)

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()
const { loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadTrigger.trigger,
)

await loadRelatedTableMeta()

const addIcon = computed(() => (cellValue?.value ? MdiArrowExpand : MdiPlus))

const value = computed(() => {
  if (cellValue?.value) {
    return cellValue?.value
  } else if (isNew.value) {
    return state?.value?.[column?.value.title as string]
  }
  return null
})

const unlinkRef = async (rec: Record<string, any>) => {
  if (isNew.value) {
    removeLTARRef(rec, column?.value as ColumnType)
  } else {
    await unlink(rec)
  }
}
</script>

<template>
  <div class="flex w-full chips-wrapper align-center" :class="{ active }">
    <div class="chips d-flex align-center flex-grow">
      <template v-if="value && relatedTablePrimaryValueProp">
        <ItemChip :item="value" :value="value[relatedTablePrimaryValueProp]" @unlink="unlinkRef(value)" />
      </template>
    </div>
    <div v-if="!readonly" class="flex-1 flex justify-end gap-1 min-h-[30px] align-center">
      <component
        :is="addIcon"
        class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 select-none group-hover:(text-gray-500)"
        @click="listItemsDlg = true"
      />
    </div>
    <ListItems v-model="listItemsDlg" @attach-record="listItemsDlg = true" />
  </div>
</template>

<style scoped lang="scss">
.nc-action-icon {
  @apply hidden cursor-pointer;
}

.chips-wrapper:hover,
.chips-wrapper.active {
  .nc-action-icon {
    @apply inline-block;
  }
}
</style>
