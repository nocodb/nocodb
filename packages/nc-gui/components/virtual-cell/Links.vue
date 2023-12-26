<script setup lang="ts">
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import { ref } from 'vue'
import type { Ref } from 'vue'
import {
  ActiveCellInj,
  CellValueInj,
  ColumnInj,
  IsExpandedFormOpenInj,
  IsUnderLookupInj,
  inject,
  useSelectedCellKeyupListener,
} from '#imports'

const value = inject(CellValueInj, ref(0))

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const colTitle = computed(() => column.value?.title || '')

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const { isUIAllowed } = useRoles()

const { t } = useI18n()

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
  if (isForm?.value || isNew.value) {
    return state.value?.[colTitle.value]?.length
      ? `${+state.value?.[colTitle.value]?.length} ${t('msg.recordsLinked')}`
      : t('msg.noRecordsLinked')
  }

  const parsedValue = +value?.value || 0

  if (!parsedValue) {
    return t('msg.noRecordsLinked')
  } else if (parsedValue === 1) {
    return `1 ${column.value?.meta?.singular || t('general.link')}`
  } else {
    return `${parsedValue} ${column.value?.meta?.plural || t('general.links')}`
  }
})

const toatlRecordsLinked = computed(() => {
  if (isForm?.value) {
    return state.value?.[colTitle.value]?.length
  }
  return +value?.value || 0
})

const onAttachRecord = () => {
  childListDlg.value = false
  listItemsDlg.value = true
}

const openChildList = () => {
  if (isUnderLookup.value) return

  childListDlg.value = true
}

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      if (listItemsDlg.value) return
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

const openListDlg = () => {
  if (isUnderLookup.value) return

  listItemsDlg.value = true
}

const plusBtnRef = ref<HTMLElement | null>(null)
const childListDlgRef = ref<HTMLElement | null>(null)

watch([childListDlg], () => {
  if (!childListDlg.value) {
    childListDlgRef.value?.focus()
  }
})

watch([listItemsDlg], () => {
  if (!listItemsDlg.value) {
    plusBtnRef.value?.focus()
  }
})
</script>

<template>
  <div
    class="flex w-full group items-center nc-links-wrapper py-1"
    :class="{
      'px-2': isExpandedFormOpen,
    }"
    @dblclick.stop="openChildList"
  >
    <div class="block flex-shrink truncate">
      <component
        :is="isUnderLookup ? 'span' : 'a'"
        ref="childListDlgRef"
        v-e="['c:cell:links:modal:open']"
        :title="textVal"
        class="text-center nc-datatype-link underline-transparent"
        :class="{ '!text-gray-300': !textVal }"
        tabindex="0"
        @click.stop.prevent="openChildList"
        @keydown.enter.stop.prevent="openChildList"
      >
        {{ textVal }}
      </component>
    </div>
    <div class="flex-grow" />

    <div
      v-if="!isUnderLookup"
      ref="plusBtnRef"
      tabindex="0"
      class="!xs:hidden flex group justify-end group-hover:flex items-center"
      @keydown.enter.stop="openListDlg"
    >
      <MdiPlus
        v-if="(!readOnly && isUIAllowed('dataEdit')) || isForm"
        class="select-none !text-md text-gray-700 nc-action-icon nc-plus invisible group-hover:visible group-focus:visible"
        @click.stop="openListDlg"
      />
    </div>
    <LazyVirtualCellComponentsListItems
      v-if="listItemsDlg || childListDlg"
      v-model="listItemsDlg"
      :column="relatedTableDisplayColumn"
    />

    <LazyVirtualCellComponentsListChildItems
      v-if="listItemsDlg || childListDlg"
      v-model="childListDlg"
      :items="toatlRecordsLinked"
      :column="relatedTableDisplayColumn"
      :cell-value="localCellValue"
      @attach-record="onAttachRecord"
    />
  </div>
</template>
