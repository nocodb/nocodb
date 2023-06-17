<script setup lang="ts">
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { CellValueInj, ColumnInj, inject, useSelectedCellKeyupListener } from '#imports'

const value = inject(CellValueInj)

const column = inject(ColumnInj)!

const meta = inject(MetaInj, ref())

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
  if (!value.value) {
    return 'Empty'
  } else if (value.value === 1) {
    return `1 ${column.value?.meta?.singular || 'Link'}`
  } else {
    return `${value.value} ${column.value?.meta?.plural || 'Links'}`
  }
})

const onAttachRecord = () => {
  childListDlg.value = false
  listItemsDlg.value = true
}

const openChildList = () => {
  if (!isLocked.value) childListDlg.value = true
}

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      if (isLocked.value) return
      childListDlg.value = true
      e.stopPropagation()
      break
  }
})
</script>

<template>
  <div class="flex w-full items-center" @dblclick.stop="openChildList = true">
    <template v-if="!isForm">
      <div class="flex-grow block">
        <component
          :is="isLocked ? 'span' : 'a'"
          class="text-center pl-3 nc-datatype-link"
          :class="{ '!text-gray-300': !value }"
          @click.stop.prevent="openChildList"
        >
          {{ textVal }}
        </component>
      </div>

      <div v-if="!isLocked && !isUnderLookup" class="flex justify-end gap-1 min-h-[30px] items-center">
        <GeneralIcon
          v-if="!readOnly && isUIAllowed('xcDatatableEditable')"
          icon="plus"
          class="select-none text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-plus"
          @click.stop="listItemsDlg = true"
        />
      </div>
    </template>

    <LazyVirtualCellComponentsListItems v-model="listItemsDlg" :column="relatedTableDisplayColumn" />

    <LazyVirtualCellComponentsListChildItems
      v-model="childListDlg"
      :column="relatedTableDisplayColumn"
      @attach-record="onAttachRecord"
    />
  </div>
</template>
