<script setup lang="ts">
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ref } from 'vue'

const value = inject(CellValueInj, ref(0))

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const colTitle = computed(() => column.value?.title || '')

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const isOpen = ref(false)

const hideBackBtn = ref(false)

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
  hideBackBtn.value = false
}

const onAttachLinkedRecord = () => {
  listItemsDlg.value = false
  childListDlg.value = true
}

const openChildList = () => {
  if (isUnderLookup.value) return

  childListDlg.value = true
  listItemsDlg.value = false

  isOpen.value = true
  hideBackBtn.value = false
}

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      if (listItemsDlg.value) return
      childListDlg.value = true
      isOpen.value = true
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
  childListDlg.value = false
  isOpen.value = true
  hideBackBtn.value = true
}

watch([childListDlg, listItemsDlg], () => {
  isOpen.value = childListDlg.value || listItemsDlg.value
})

watch(
  isOpen,
  (next) => {
    if (!next) {
      listItemsDlg.value = false
      childListDlg.value = false
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <div class="nc-cell-field flex w-full group items-center nc-links-wrapper py-1" @dblclick.stop="openChildList">
    <LazyVirtualCellComponentsLinkRecordDropdown v-model:is-open="isOpen">
      <div class="flex w-full group items-center min-h-4">
        <div class="block flex-shrink truncate">
          <component
            :is="isUnderLookup ? 'span' : 'a'"
            v-e="['c:cell:links:modal:open']"
            :title="textVal"
            class="text-center nc-datatype-link underline-transparent"
            :class="{ '!text-gray-300': !textVal }"
            :tabindex="readOnly ? -1 : 0"
            @click.stop.prevent="openChildList"
            @keydown.enter.stop.prevent="openChildList"
          >
            {{ textVal }}
          </component>
        </div>
        <div class="flex-grow" />

        <div
          v-if="!isUnderLookup"
          :tabindex="readOnly ? -1 : 0"
          class="!xs:hidden flex group justify-end group-hover:flex items-center"
          @keydown.enter.stop="openListDlg"
        >
          <MdiPlus
            v-if="(!readOnly && isUIAllowed('dataEdit')) || isForm"
            class="select-none !text-md text-gray-700 nc-action-icon nc-plus invisible group-hover:visible group-focus:visible"
            @click.stop="openListDlg"
          />
        </div>
      </div>

      <template #overlay>
        <LazyVirtualCellComponentsLinkedItems
          v-if="childListDlg"
          v-model="childListDlg"
          :items="toatlRecordsLinked"
          :column="relatedTableDisplayColumn"
          :cell-value="localCellValue"
          @attach-record="onAttachRecord"
        />
        <LazyVirtualCellComponentsUnLinkedItems
          v-if="listItemsDlg"
          v-model="listItemsDlg"
          :column="relatedTableDisplayColumn"
          :hide-back-btn="hideBackBtn"
          @attach-linked-record="onAttachLinkedRecord"
        />
      </template>
    </LazyVirtualCellComponentsLinkRecordDropdown>
  </div>
</template>
