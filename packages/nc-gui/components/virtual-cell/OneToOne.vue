<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { type Ref, ref } from 'vue'
import { forcedNextTick } from '../../utils/browserUtils'

const column = inject(ColumnInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const cellValue = inject(CellValueInj, ref<any>(null))

const row = inject(RowInj)!

const active = inject(ActiveCellInj)!

const readOnly = inject(ReadonlyInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const isCanvasInjected = inject(IsCanvasInjectionInj, false)

const clientMousePosition = inject(ClientMousePositionInj, reactive(clientMousePositionDefaultValue))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))

const cellEventHook = inject(CellEventHookInj, null)

const cellClickHook = inject(CellClickHookInj, null)

const onDivDataCellEventHook = inject(OnDivDataCellEventHookInj, null)

const { isUIAllowed } = useRoles()

const listItemsDlg = ref(false)

const isOpen = ref(false)

const { state, isNew, removeLTARRef } = useSmartsheetRowStoreOrThrow()

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp, relatedTableDisplayValuePropId, unlink } =
  useProvideLTARStore(column as Ref<Required<ColumnType>>, row, isNew, reloadRowTrigger.trigger)

await loadRelatedTableMeta()

const hasEditPermission = computed(() => {
  return (!readOnly.value && isUIAllowed('dataEdit') && !isUnderLookup.value) || isForm.value
})

const addIcon = computed(() => (cellValue?.value ? 'maximize' : 'plus'))

const value = computed(() => {
  if (cellValue?.value) {
    return cellValue?.value
  } else if (isNew.value) {
    const columnTitle = column?.value.title as string
    const columnValue = state?.value?.[columnTitle]
    return Array.isArray(columnValue) ? columnValue[0] : columnValue
  }
  return null
})

const unlinkRef = async (rec: Record<string, any>) => {
  if (isNew.value) {
    await removeLTARRef(rec, column?.value as ColumnType)
  } else {
    await unlink(rec)
  }
}

useSelectedCellKeydownListener(active, (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      listItemsDlg.value = true
      e.stopPropagation()
      break
  }
})

const belongsToColumn = computed(
  () =>
    relatedTableMeta.value?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp.value) as ColumnType | undefined,
)

watch(listItemsDlg, () => {
  isOpen.value = listItemsDlg.value
})

// When isOpen is false, ensure the listItemsDlg is also closed.
watch(
  isOpen,
  (next) => {
    if (!next) {
      listItemsDlg.value = false
    }
  },
  { flush: 'post' },
)

function onCellClick(e: Event) {
  if (e.type !== 'click' || !hasEditPermission.value) return
  if (isExpandedFormOpen.value || isForm.value || active.value) {
    listItemsDlg.value = true
  }
}

const onCellEvent = (event?: Event) => {
  if (!(event instanceof KeyboardEvent) || !event.target || isActiveInputElementExist(event) || !hasEditPermission.value) return

  if (isExpandCellKey(event)) {
    if (listItemsDlg.value) {
      listItemsDlg.value = false
    } else {
      listItemsDlg.value = true
    }

    return true
  }
}

onMounted(() => {
  onDivDataCellEventHook?.on(onCellClick)
  cellClickHook?.on(onCellClick)
  cellEventHook?.on(onCellEvent)

  if (!hasEditPermission.value || !isCanvasInjected || !clientMousePosition || isExpandedFormOpen.value) return

  forcedNextTick(() => {
    if (onCellEvent(canvasCellEventData.event)) return

    if (getElementAtMouse('.unlink-icon', clientMousePosition)) {
      unlinkRef(value.value)
    } else if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-plus.nc-action-icon', clientMousePosition)) {
      listItemsDlg.value = true
    } else {
      listItemsDlg.value = true
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
    <div class="nc-cell-field flex w-full chips-wrapper items-center min-h-6.5 relative" :class="{ active }">
      <div class="chips flex items-center flex-1 max-w-[calc(100%_-_16px)] min-h-[28px]">
        <template v-if="value && (relatedTableDisplayValueProp || relatedTableDisplayValuePropId)">
          <VirtualCellComponentsItemChip
            :item="value"
            :value="
              !Array.isArray(value) && typeof value === 'object'
                ? value[relatedTableDisplayValueProp] ?? value[relatedTableDisplayValuePropId]
                : value
            "
            :column="belongsToColumn"
            :show-unlink-button="true"
            @unlink="unlinkRef(value)"
          />
        </template>
      </div>

      <div
        v-if="hasEditPermission"
        class="flex justify-end group gap-1 min-h-4 items-center"
        tabindex="0"
        @keydown.enter.stop="listItemsDlg = true"
      >
        <GeneralIcon
          :icon="addIcon"
          class="!text-md select-none text-gray-700 nc-action-icon nc-plus invisible group-hover:visible group-focus:visible"
          :class="{
            '!visible !text-gray-600': isCanvasInjected && active,
          }"
          @click.stop="listItemsDlg = true"
        />
      </div>
    </div>
    <template #overlay>
      <LazyVirtualCellComponentsUnLinkedItems
        v-if="listItemsDlg"
        v-model="listItemsDlg"
        :column="belongsToColumn"
        hide-back-btn
        @escape="isOpen = false"
      />
    </template>
  </LazyVirtualCellComponentsLinkRecordDropdown>
</template>

<style scoped lang="scss">
.nc-action-icon {
  @apply cursor-pointer;
}

.chips-wrapper:hover,
.chips-wrapper.active {
  .nc-action-icon {
    @apply inline-block;
  }
}

.chips-wrapper:hover {
  .nc-action-icon {
    @apply visible;
  }
}
</style>
