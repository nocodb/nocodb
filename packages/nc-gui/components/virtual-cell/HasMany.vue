<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  CellValueInj,
  ColumnInj,
  IsFormInj,
  IsLockedInj,
  ReadonlyInj,
  ReloadRowDataHookInj,
  RowInj,
  computed,
  inject,
  ref,
  useProvideLTARStore,
  useSelectedCellKeyupListener,
  useSmartsheetRowStoreOrThrow,
  useUIPermission,
} from '#imports'

const column = inject(ColumnInj)!

const cellValue = inject(CellValueInj)!

const row = inject(RowInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, ref(false))

const isLocked = inject(IsLockedInj)

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { isUIAllowed } = useUIPermission()

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()

const { loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadRowTrigger.trigger,
)

await loadRelatedTableMeta()

const localCellValue = computed<any[]>(() => {
  if (cellValue?.value) {
    return cellValue?.value ?? []
  } else if (isNew.value) {
    return state?.value?.[column?.value.title as string] ?? []
  }
  return []
})

const cells = computed(() =>
  localCellValue.value.reduce((acc, curr) => {
    if (!relatedTablePrimaryValueProp.value) return acc

    const value = curr[relatedTablePrimaryValueProp.value]

    if (!value) return acc

    return [...acc, { value, item: curr }]
  }, []),
)

const unlinkRef = async (rec: Record<string, any>) => {
  if (isNew.value) {
    await removeLTARRef(rec, column.value)
  } else {
    await unlink(rec)
  }
}

const onAttachRecord = () => {
  childListDlg.value = false
  listItemsDlg.value = true
}

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      listItemsDlg.value = true
      e.stopPropagation()
      break
  }
})
</script>

<template>
  <div class="flex items-center items-center gap-1 w-full chips-wrapper">
    <template v-if="!isForm">
      <div class="chips flex items-center img-container flex-1 hm-items flex-nowrap min-w-0 overflow-hidden">
        <template v-if="cells">
          <VirtualCellComponentsItemChip
            v-for="(cell, i) of cells"
            :key="i"
            :item="cell.item"
            :value="cell.value"
            @unlink="unlinkRef(cell.item)"
          />

          <span v-if="cellValue?.length === 10" class="caption pointer ml-1 grey--text" @click="childListDlg = true">
            more...
          </span>
        </template>
      </div>

      <div v-if="!isLocked" class="flex justify-end gap-1 min-h-[30px] items-center">
        <MdiArrowExpand
          class="select-none transform text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-arrow-expand"
          @click.stop="childListDlg = true"
        />

        <MdiPlus
          v-if="!readOnly && isUIAllowed('xcDatatableEditable')"
          class="select-none text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-plus"
          @click.stop="listItemsDlg = true"
        />
      </div>
    </template>

    <LazyVirtualCellComponentsListItems v-model="listItemsDlg" />

    <LazyVirtualCellComponentsListChildItems
      v-model="childListDlg"
      :cell-value="localCellValue"
      @attach-record="onAttachRecord"
    />
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
