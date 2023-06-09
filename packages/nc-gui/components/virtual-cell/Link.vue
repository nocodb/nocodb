<script setup lang="ts">
import { computed } from '@vue/reactivity'
import { inflect } from 'inflection'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { CellValueInj, inject } from '#imports'
import { pluralize, singularize } from 'inflection'

const value = inject(CellValueInj)

const column = inject(ColumnInj)!

const meta = inject(MetaInj, ref())

const relColumn = computed(() => {
  return meta.value.columns.find((c: ColumnType) => c.id === column.value?.colOptions?.fk_relation_column_id)
})

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
  relColumn as Ref<Required<ColumnType>>,
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
    return `1 ${singularize(relatedTableMeta.value?.title ?? '')}`
  } else {
    return `${value.value} ${pluralize(relatedTableMeta.value?.title ?? '')}`
  }
})

const onAttachRecord = () => {
  childListDlg.value = false
  listItemsDlg.value = true
}
</script>

<template>
  <div class="flex w-full items-center">
    <a @click.stop.prevent="childListDlg = true" class="text-center pl-3 flex-grow block"
       :class="{'!text-gray-300': !value}">
      {{ textVal }}
    </a>

    <div v-if="!isLocked && !isUnderLookup" class="flex justify-end gap-1 min-h-[30px] items-center">
      <!--      <GeneralIcon-->
      <!--        icon="expand"-->
      <!--        class="select-none transform text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-arrow-expand"-->
      <!--        @click.stop="childListDlg = true"-->
      <!--      />-->

      <GeneralIcon
        v-if="!readOnly && isUIAllowed('xcDatatableEditable')"
        icon="plus"
        class="select-none text-sm nc-action-icon text-gray-500/50 hover:text-gray-500 nc-plus"
        @click.stop="listItemsDlg = true"
      />
    </div>

    <LazyVirtualCellComponentsListItems v-model="listItemsDlg" :column="relatedTableDisplayColumn" />

    <LazyVirtualCellComponentsListChildItems
      v-model="childListDlg"
      :column="relatedTableDisplayColumn"
      @attach-record="onAttachRecord"
    />
  </div>
</template>
