<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  ActiveCellInj,
  CellValueInj,
  ColumnInj,
  IsFormInj,
  IsLockedInj,
  ReadonlyInj,
  ReloadRowDataHookInj,
  RowInj,
  computed,
  createEventHook,
  inject,
  ref,
  useProvideLTARStore,
  useSmartsheetRowStoreOrThrow,
  useUIPermission,
} from '#imports'
import MdiArrowExpand from '~icons/mdi/arrow-expand'
import MdiPlus from '~icons/mdi/plus'

const column = inject(ColumnInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const cellValue = inject(CellValueInj, ref<any>(null))

const row = inject(RowInj)!

const active = inject(ActiveCellInj)!

const readOnly = inject(ReadonlyInj, false)

const isForm = inject(IsFormInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { isUIAllowed } = useUIPermission()

const listItemsDlg = ref(false)

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()

const { loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadRowTrigger.trigger,
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
    await removeLTARRef(rec, column?.value as ColumnType)
  } else {
    await unlink(rec)
  }
}
</script>

<template>
  <div class="flex w-full chips-wrapper items-center" :class="{ active }">
    <div class="chips flex items-center flex-1">
      <template v-if="value && relatedTablePrimaryValueProp">
        <VirtualCellComponentsItemChip :item="value" :value="value[relatedTablePrimaryValueProp]" @unlink="unlinkRef(value)" />
      </template>
    </div>

    <div
      v-if="!readOnly && !isLocked && (isUIAllowed('xcDatatableEditable') || isForm)"
      class="flex justify-end gap-1 min-h-[30px] items-center"
    >
      <component
        :is="addIcon"
        class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 select-none group-hover:(text-gray-500) nc-plus"
        @click="listItemsDlg = true"
      />
    </div>

    <LazyVirtualCellComponentsListItems v-model="listItemsDlg" @attach-record="listItemsDlg = true" />
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
