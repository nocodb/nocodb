<script setup lang="ts">
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { ActiveCellInj, CellValueInj, ColumnInj, IsUnderLookupInj, inject, useSelectedCellKeyupListener } from '#imports'

const value = inject(CellValueInj, ref(0))

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { isUIAllowed } = useUIPermission()

const { state, isNew } = useSmartsheetRowStoreOrThrow()

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadRowTrigger.trigger,
)
const relatedTableDisplayColumn = computed(
  () =>
    relatedTableMeta.value?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp.value) as ColumnType | undefined,
)

loadRelatedTableMeta()

const textVal = computed(() => {
  const parsedValue = +value?.value || 0

  if (!parsedValue) {
    return 'Empty'
  } else if (parsedValue === 1) {
    return `1 ${column.value?.meta?.singular || 'Link'}`
  } else {
    return `${parsedValue} ${column.value?.meta?.plural || 'Links'}`
  }
})

const onAttachRecord = () => {
  childListDlg.value = false
  listItemsDlg.value = true
}

const openChildList = () => {
  if (!isLocked.value) {
    childListDlg.value = true
  }
}

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      if (isLocked.value || listItemsDlg.value) return
      childListDlg.value = true
      e.stopPropagation()
      break
  }
})

const localCellValue = computed<any[]>(() => {
  if (isNew.value) {
    return state?.value?.[column?.value.title as string] ?? []
  }
  return []
})
</script>

<template>
  <div class="flex w-full items-center nc-links-wrapper" @dblclick.stop="openChildList">
    <template v-if="!isForm">
      <div class="block flex-shrink truncate">
        <component
          :is="isLocked || isUnderLookup ? 'span' : 'a'"
          :title="textVal"
          class="text-center pl-3 nc-datatype-link underline-transparent"
          :class="{ '!text-gray-300': !value }"
          @click.stop.prevent="openChildList"
        >
          {{ textVal }}
        </component>
      </div>
      <div class="flex-grow" />

      <div v-if="!isLocked && !isUnderLookup" class="flex justify-end gap-1 min-h-[30px] items-center">
        <GeneralIcon
          v-if="!readOnly && isUIAllowed('xcDatatableEditable')"
          icon="plus"
          class="nc-icon-transition select-none !text-xxl nc-action-icon text-gray-500/50 hover:text-gray-500 nc-plus hover:text-shadow-md"
          @click.stop="listItemsDlg = true"
        />
      </div>
    </template>

    <LazyVirtualCellComponentsListItems v-model="listItemsDlg" :column="relatedTableDisplayColumn" />

    <LazyVirtualCellComponentsListChildItems
      v-model="childListDlg"
      :column="relatedTableDisplayColumn"
      :cell-value="localCellValue"
      @attach-record="onAttachRecord"
    />
  </div>
</template>
