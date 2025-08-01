<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { type Ref, ref } from 'vue'
import { forcedNextTick } from '../../utils/browserUtils'

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const cellValue = inject(CellValueInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const cellClickHook = inject(CellClickHookInj, null)

const onDivDataCellEventHook = inject(OnDivDataCellEventHookInj, null)

const readOnly = inject(ReadonlyInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const isOpen = ref(false)

const hideBackBtn = ref(false)

const rowHeight = inject(RowHeightInj, ref())

const isCanvasInjected = inject(IsCanvasInjectionInj, false)

const clientMousePosition = inject(ClientMousePositionInj, reactive(clientMousePositionDefaultValue))

const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))

const cellEventHook = inject(CellEventHookInj, null)

const { isUIAllowed } = useRoles()

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp, unlink } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadRowTrigger.trigger,
)

await loadRelatedTableMeta()

const hasEditPermission = computed(() => {
  return (!readOnly.value && isUIAllowed('dataEdit') && !isUnderLookup.value) || isForm.value
})

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

const openListDlg = () => {
  if (!hasEditPermission.value) return

  listItemsDlg.value = true
  childListDlg.value = false
  isOpen.value = true
  hideBackBtn.value = true
}

useSelectedCellKeydownListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
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

const active = inject(ActiveCellInj, ref(false))
function onCellClick(e: Event) {
  if (e.type !== 'click') return
  if (isExpandedForm.value || isForm.value || active.value) {
    openChildList()
  }
}

const onCellEvent = (event?: Event) => {
  if (!(event instanceof KeyboardEvent) || !event.target || isActiveInputElementExist(event)) return

  if (isExpandCellKey(event)) {
    if (childListDlg.value) {
      listItemsDlg.value = false
      childListDlg.value = false
    } else {
      openChildList()
    }

    return true
  }
}

onMounted(() => {
  onDivDataCellEventHook?.on(onCellClick)
  cellClickHook?.on(onCellClick)
  cellEventHook?.on(onCellEvent)

  if (isUnderLookup.value || !isCanvasInjected || isExpandedForm.value || !clientMousePosition) return

  forcedNextTick(() => {
    if (onCellEvent(canvasCellEventData.event)) return

    if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-many-to-many-plus-icon', clientMousePosition)) {
      openListDlg()
    } else if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-many-to-many-maximize-icon', clientMousePosition)) {
      openChildList()
    } else if (hasEditPermission.value) {
      openListDlg()
    } else {
      openChildList()
    }
  })
})

onUnmounted(() => {
  onDivDataCellEventHook?.off(onCellClick)
  cellClickHook?.off(onCellClick)
  cellEventHook?.off(onCellEvent)
})
</script>

<template>
  <LazyVirtualCellComponentsLinkRecordDropdown v-model:is-open="isOpen">
    <div class="nc-cell-field flex items-center gap-1 w-full chips-wrapper min-h-6.5 relative">
      <div
        class="chips flex items-center img-container flex-1 hm-items min-w-0 overflow-y-auto overflow-x-hidden"
        :class="{ 'flex-wrap': rowHeight !== 1 }"
        :style="{ maxHeight: `${rowHeightInPx[rowHeight]}px` }"
      >
        <template v-if="cells">
          <VirtualCellComponentsItemChip
            v-for="(cell, i) of cells"
            :key="i"
            :item="cell.item"
            :value="cell.value"
            :column="m2mColumn"
            :show-unlink-button="false"
            :truncate="false"
            @unlink="unlinkRef(cell.item)"
          />

          <span v-if="cells?.length === 10" class="caption pointer ml-1 grey--text" @click.stop="openChildList"> more... </span>
        </template>
      </div>

      <div
        v-if="!isUnderLookup || isForm"
        class="flex justify-end gap-[2px] min-h-4 items-center absolute right-0 top-0 bottom-0 many-to-many-actions"
        :class="{ active }"
        @click.stop
      >
        <NcButton
          v-if="hasEditPermission"
          size="xxsmall"
          type="secondary"
          class="nc-action-icon nc-many-to-many-plus-icon !h-5 !w-5"
          @click.stop="openListDlg"
        >
          <GeneralIcon icon="plus" class="text-sm nc-plus h-3 w-3" />
        </NcButton>
        <NcTooltip :title="$t('tooltip.expandShiftSpace')" :disabled="isExpandedForm" class="flex">
          <NcButton
            size="xxsmall"
            type="secondary"
            class="nc-action-icon nc-many-to-many-maximize-icon !h-5 !w-5"
            @click.stop="openChildList"
          >
            <GeneralIcon icon="maximize" class="!h-3 !w.3" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <template #overlay>
      <LazyVirtualCellComponentsLinkedItems
        v-if="childListDlg"
        v-model="childListDlg"
        :cell-value="localCellValue"
        :column="m2mColumn"
        @attach-record="onAttachRecord"
        @escape="isOpen = false"
      />
      <LazyVirtualCellComponentsUnLinkedItems
        v-if="listItemsDlg"
        v-model="listItemsDlg"
        :column="m2mColumn"
        :hide-back-btn="hideBackBtn"
        @attach-linked-record="onAttachLinkedRecord"
        @escape="isOpen = false"
      />
    </template>
  </LazyVirtualCellComponentsLinkRecordDropdown>
</template>

<style scoped>
.many-to-many-actions {
  @apply hidden;
}

.many-to-many-actions.active,
.chips-wrapper:hover .many-to-many-actions {
  @apply flex;
}
</style>

<style lang="scss">
.nc-default-value-wrapper,
.nc-expanded-cell,
.ant-form-item-control-input {
  .many-to-many-actions {
    @apply !flex;
  }
}
</style>
