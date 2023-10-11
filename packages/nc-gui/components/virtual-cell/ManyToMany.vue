<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  ActiveCellInj,
  CellValueInj,
  ColumnInj,
  IsFormInj,
  IsLockedInj,
  IsUnderLookupInj,
  ReadonlyInj,
  ReloadRowDataHookInj,
  RowInj,
  computed,
  createEventHook,
  inject,
  ref,
  useProvideLTARStore,
  useRoles,
  useSelectedCellKeyupListener,
  useSmartsheetRowStoreOrThrow,
} from '#imports'

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const cellValue = inject(CellValueInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, ref(false))

const isLocked = inject(IsLockedInj)

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { isUIAllowed } = useRoles()

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp, unlink } = useProvideLTARStore(
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
    if (!relatedTableDisplayValueProp.value) return acc

    const value = curr[relatedTableDisplayValueProp.value]

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

const m2mColumn = computed(
  () =>
    relatedTableMeta.value?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp.value) as ColumnType | undefined,
)
</script>

<template>
  <div class="flex items-center gap-1 w-full chips-wrapper">
    <div class="chips flex items-center img-container flex-1 hm-items flex-nowrap min-w-0 overflow-hidden">
      <template v-if="cells">
        <VirtualCellComponentsItemChip
          v-for="(cell, i) of cells"
          :key="i"
          :item="cell.item"
          :value="cell.value"
          :column="m2mColumn"
          :show-unlink-button="true"
          @unlink="unlinkRef(cell.item)"
        />

        <span v-if="cells?.length === 10" class="caption pointer ml-1 grey--text" @click.stop="childListDlg = true">
          more...
        </span>
      </template>
    </div>

    <div v-if="(!isLocked && !isUnderLookup) || isForm" class="flex justify-end gap-1 min-h-[30px] items-center">
      <GeneralIcon
        icon="expand"
        class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-arrow-expand"
        @click.stop="childListDlg = true"
      />

      <GeneralIcon
        v-if="!readOnly && isUIAllowed('dataEdit')"
        icon="plus"
        class="text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-plus"
        @click.stop="listItemsDlg = true"
      />
    </div>

    <LazyVirtualCellComponentsListItems v-if="listItemsDlg || childListDlg" v-model="listItemsDlg" :column="m2mColumn" />

    <LazyVirtualCellComponentsListChildItems
      v-if="listItemsDlg || childListDlg"
      v-model="childListDlg"
      :cell-value="localCellValue"
      :column="m2mColumn"
      @attach-record="onAttachRecord"
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
