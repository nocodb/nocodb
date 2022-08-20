<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  CellValueInj,
  ColumnInj,
  IsFormInj,
  IsLockedInj,
  ReadonlyInj,
  ReloadViewDataHookInj,
  RowInj,
  computed,
  defineAsyncComponent,
  inject,
  ref,
  useProvideLTARStore,
  useSmartsheetRowStoreOrThrow,
  useUIPermission,
} from '#imports'

const ItemChip = defineAsyncComponent(() => import('./components/ItemChip.vue'))

const ListItems = defineAsyncComponent(() => import('./components/ListItems.vue'))

const ListChildItems = defineAsyncComponent(() => import('./components/ListChildItems.vue'))

const column = inject(ColumnInj)!

const cellValue = inject(CellValueInj)!

const row = inject(RowInj)!

const reloadTrigger = inject(ReloadViewDataHookInj)!

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, false)

const isLocked = inject(IsLockedInj)

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { isUIAllowed } = useUIPermission()

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
    return cellValue?.value ?? []
  } else if (isNew.value) {
    return state?.value?.[column?.value.title as string] ?? []
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
  <div class="flex items-center items-center gap-1 w-full chips-wrapper">
    <template v-if="!isForm">
      <div class="chips flex items-center img-container flex-1 hm-items flex-nowrap min-w-0 overflow-hidden">
        <template v-if="cells">
          <ItemChip v-for="(cell, i) of cells" :key="i" :item="cell.item" :value="cell.value" @unlink="unlinkRef(cell.item)" />
          <span v-if="cellValue?.length === 10" class="caption pointer ml-1 grey--text" @click="childListDlg = true">
            more...
          </span>
        </template>
      </div>
      <div
        v-if="!isLocked && isUIAllowed('xcDatatableEditable')"
        class="flex-1 flex justify-end gap-1 min-h-[30px] items-center"
      >
        <MdiArrowExpand
          class="select-none transform text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-arrow-expand"
          @click="childListDlg = true"
        />
        <MdiPlus
          v-if="!readOnly"
          class="select-none text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-plus"
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
  @apply flex;
}
</style>
