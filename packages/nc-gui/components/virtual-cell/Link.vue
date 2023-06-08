<script setup lang="ts">
import { CellValueInj, inject, useShowNotEditableWarning } from '#imports'
import { Ref } from 'vue'

const value = inject(CellValueInj)








const column = inject(ColumnInj)!

const relColumn = computed(() => {
  return column.value?.related_column
}


const cellValue = inject(CellValueInj)!

const row = inject(RowInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, ref(false))

const isLocked = inject(IsLockedInj)

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { isUIAllowed } = useUIPermission()

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadRowTrigger.trigger,
)


</script>

<template>
  <div>
    <span class="text-center pl-3">
      {{ value }}
    </span>



    <LazyVirtualCellComponentsListItems v-model="listItemsDlg" :column="relColumn" />

    <LazyVirtualCellComponentsListChildItems
      v-model="childListDlg"
      :cell-value="localCellValue"
      :column="relColumn"
      @attach-record="onAttachRecord"
    />





  </div>
</template>
