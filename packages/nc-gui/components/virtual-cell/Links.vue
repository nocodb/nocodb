<script setup lang="ts">
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { forcedNextTick } from '../../utils/browserUtils'

const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const clientMousePosition = inject(ClientMousePositionInj)

const value = inject(CellValueInj, ref(0))

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

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

useSelectedCellKeydownListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
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

onMounted(() => {
  if (!isUnderLookup.value && isCanvasInjected && !isExpandedFormOpen.value && clientMousePosition) {
    forcedNextTick(() => {
      if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-canvas-links-icon-plus', clientMousePosition)) {
        openListDlg()
      } else if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-canvas-links-text', clientMousePosition)) {
        openChildList()
      } else {
        openListDlg()
      }
    })
  }
})
</script>

<template>
  <div class="nc-cell-field flex w-full group items-center nc-links-wrapper py-1" @dblclick.stop="openChildList">
    <VirtualCellComponentsLinkRecordDropdown v-model:is-open="isOpen">
      <div class="flex w-full group items-center min-h-4">
        <div class="block flex-shrink truncate">
          <component
            :is="isUnderLookup ? 'span' : 'a'"
            v-e="['c:cell:links:modal:open']"
            :title="textVal"
            class="text-center nc-datatype-link underline-transparent nc-canvas-links-text font-weight-500"
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
          :class="{ hidden: isUnderLookup }"
          :tabindex="readOnly ? -1 : 0"
          class="!xs:hidden flex group justify-end group-hover:flex items-center nc-canvas-links-icon-plus"
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
        <VirtualCellComponentsLinkedItems
          v-if="childListDlg"
          v-model="childListDlg"
          :items="toatlRecordsLinked"
          :column="relatedTableDisplayColumn"
          :cell-value="localCellValue"
          @attach-record="onAttachRecord"
          @escape="isOpen = false"
        />
        <VirtualCellComponentsUnLinkedItems
          v-if="listItemsDlg"
          v-model="listItemsDlg"
          :column="relatedTableDisplayColumn"
          :hide-back-btn="hideBackBtn"
          @attach-linked-record="onAttachLinkedRecord"
          @escape="isOpen = false"
        />
      </template>
    </VirtualCellComponentsLinkRecordDropdown>
  </div>
</template>
