<script setup lang="ts">
import { UITypes, getRenderAsTextFunForUiType } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, RollupType } from 'nocodb-sdk'
import { forcedNextTick } from '../../utils/browserUtils'

const { metas } = useMetas()

const value = inject(CellValueInj)

const column = inject(ColumnInj)!

const meta = inject(MetaInj, ref())

const row = inject(RowInj)!

const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const clientMousePosition = inject(ClientMousePositionInj)
const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))
const cellEventHook = inject(CellEventHookInj, null)
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()

const relationColumnOptions = computed<LinkToAnotherRecordType | null>(() => {
  if ((column?.value?.colOptions as RollupType)?.fk_relation_column_id) {
    return meta?.value?.columns?.find((c) => c.id === (column?.value?.colOptions as RollupType)?.fk_relation_column_id)
      ?.colOptions as LinkToAnotherRecordType
  }
  return null
})

const relatedTableMeta = computed(
  () =>
    relationColumnOptions.value?.fk_related_model_id && metas.value?.[relationColumnOptions.value?.fk_related_model_id as string],
)

const colOptions = computed(() => column.value?.colOptions)

const childColumn = computed(() => {
  if (relatedTableMeta.value?.columns) {
    if (isRollup(column.value)) {
      return relatedTableMeta.value?.columns.find(
        (c: ColumnType) => c.id === (colOptions.value as RollupType).fk_rollup_column_id,
      )
    }
  }
  return ''
})

const renderAsTextFun = computed(() => {
  return getRenderAsTextFunForUiType(childColumn.value?.uidt || UITypes.SingleLineText)
})

const showAsLinks = computed(() => {
  return parseProp(column.value?.meta)?.showAsLinks || false
})

const enableLinkActions = computed(() => {
  return parseProp(column.value?.meta)?.enableLinkActions || false
})

// Get the original readonly state before we provide our own
const originalReadonly = inject(ReadonlyInj, ref(false))

// When showing as links, we need to control the readonly state
// If enableLinkActions is false, make it readonly to prevent editing
// but still allow viewing linked records
const readOnlyForLinks = computed(() => {
  if (!showAsLinks.value) {
    // Not showing as links, use the original readonly state
    return originalReadonly.value
  }
  // Showing as links - readonly should be based on enableLinkActions
  return !enableLinkActions.value
})

provide(ReadonlyInj, readOnlyForLinks)

const relationColumn = computed(() => {
  if (!showAsLinks.value) return null

  // Get the actual relation column from the rollup configuration
  const relationColId = (column.value?.colOptions as RollupType)?.fk_relation_column_id
  const relationCol = meta.value?.columns?.find((c) => c.id === relationColId)

  if (relationCol) {
    // Return the actual relation column - VirtualCellLinks will handle it properly
    return relationCol
  }

  return null
})

const linkText = computed(() => {
  if (!value?.value && value?.value !== 0) {
    return 'No records linked'
  }

  const parsedValue = +value.value || 0
  const columnMeta = parseProp(column?.value?.meta)

  if (!parsedValue) {
    return 'No records linked'
  } else if (parsedValue === 1) {
    return `1 ${columnMeta?.singular || 'record'}`
  } else {
    return `${parsedValue} ${columnMeta?.plural || 'records'}`
  }
})

// Set up the LTAR store for the relation column when showing as links
// We need to provide a default column to avoid errors, but it will be overridden by relationColumn
const defaultColumn = computed(() => relationColumn.value || {
  id: '',
  title: '',
  column_name: '',
  uidt: UITypes.LinkToAnotherRecord,
  colOptions: {
    fk_related_model_id: '',
    type: 'hm',
    fk_column_id: '',
    fk_child_column_id: '',
    fk_parent_column_id: '',
    fk_mm_model_id: '',
    fk_mm_child_column_id: '',
    fk_mm_parent_column_id: '',
    dr: '',
    ur: '',
    fk_index_name: '',
  }
} as ColumnType)

const {
  relatedTableMeta: linksRelatedTableMeta,
  loadRelatedTableMeta: loadLinksRelatedTableMeta,
  relatedTableDisplayValueProp: linksRelatedTableDisplayValueProp
} = useProvideLTARStore(
  defaultColumn as Ref<Required<ColumnType>>,
  inject(RowInj)!,
  ref(false), // isNew
  inject(ReloadRowDataHookInj, createEventHook()).trigger,
)

const linksRelatedTableDisplayColumn = computed(
  () =>
    linksRelatedTableMeta.value?.columns?.find((c: any) => c.title === linksRelatedTableDisplayValueProp.value) as ColumnType | undefined,
)

// Load related table meta when showing as links
watch(showAsLinks, (newValue) => {
  if (newValue && relationColumn.value) {
    loadLinksRelatedTableMeta()
  }
}, { immediate: true })

// Also watch for relationColumn changes
watch(relationColumn, (newValue) => {
  if (newValue && showAsLinks.value) {
    loadLinksRelatedTableMeta()
  }
}, { immediate: true })

const isOpen = ref(false)
const childListDlg = ref(false)
const listItemsDlg = ref(false)

const hasEditPermission = computed(() => {
  // Use the original readonly state and enableLinkActions to determine edit permission
  const isReadonly = showAsLinks.value ? !enableLinkActions.value : originalReadonly.value
  return !isReadonly && enableLinkActions.value
})

const openLinkedRecords = () => {
  if (!relationColumn.value) return

  childListDlg.value = true
  isOpen.value = true
}

const openListDlg = () => {
  if (!hasEditPermission.value) return

  listItemsDlg.value = true
  childListDlg.value = false
  isOpen.value = true
}

const onAttachRecord = () => {
  childListDlg.value = false
  listItemsDlg.value = true
}

const onAttachLinkedRecord = () => {
  listItemsDlg.value = false
  childListDlg.value = true
}

// Watch for modal state changes
watch([childListDlg, listItemsDlg], () => {
  isOpen.value = childListDlg.value || listItemsDlg.value
})

// Watch for modal close
watch(isOpen, (next) => {
  if (!next) {
    childListDlg.value = false
    listItemsDlg.value = false
  }
}, { flush: 'post' })

// Keyboard event handling
useSelectedCellKeydownListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  if (!showAsLinks.value) return

  switch (e.key) {
    case 'Enter':
      if (listItemsDlg.value) return
      openLinkedRecords()
      e.stopPropagation()
      break
  }
})

// Canvas event handling
const onCellEvent = (event?: Event) => {
  if (!showAsLinks.value) return
  if (!(event instanceof KeyboardEvent) || !event.target || isActiveInputElementExist(event)) return

  if (isExpandCellKey(event)) {
    if (childListDlg.value) {
      listItemsDlg.value = false
      childListDlg.value = false
    } else {
      openLinkedRecords()
    }
    return true
  }
}

onMounted(() => {
  if (!showAsLinks.value) return

  cellEventHook?.on(onCellEvent)

  if (isCanvasInjected && !isExpandedFormOpen.value && clientMousePosition) {
    forcedNextTick(() => {
      if (onCellEvent(canvasCellEventData.event)) return

      if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-canvas-links-icon-plus', clientMousePosition)) {
        if (hasEditPermission.value) {
          openListDlg()
        }
      } else if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-canvas-links-text', clientMousePosition)) {
        openLinkedRecords()
      } else if (hasEditPermission.value) {
        openListDlg()
      } else {
        openLinkedRecords()
      }
    })
  }
})

onUnmounted(() => {
  if (showAsLinks.value) {
    cellEventHook?.off(onCellEvent)
  }
})
</script>

<template>
  <div @dblclick.stop="activateShowEditNonEditableFieldWarning">
    <!-- Show as links when showAsLinks is enabled -->
    <template v-if="showAsLinks && relationColumn">
      <div class="nc-cell-field flex w-full group items-center nc-links-wrapper py-1" @dblclick.stop="openLinkedRecords">
        <div class="flex w-full group items-center min-h-4">
          <div class="block flex-shrink truncate">
            <a
              v-e="['c:cell:rollup-links:modal:open']"
              :title="linkText"
              class="text-center nc-datatype-link underline-transparent nc-canvas-links-text font-weight-500 cursor-pointer"
              :class="{ '!text-gray-300': !linkText }"
              @click.stop.prevent="openLinkedRecords"
              @keydown.enter.stop.prevent="openLinkedRecords"
            >
              {{ linkText }}
            </a>
          </div>
          <div class="flex-grow" />
          <div
            v-if="enableLinkActions"
            class="!xs:hidden flex group justify-end group-hover:flex items-center nc-canvas-links-icon-plus"
            @keydown.enter.stop="openListDlg"
          >
            <MdiPlus
              class="select-none !text-md text-gray-700 nc-action-icon nc-plus invisible group-hover:visible group-focus:visible"
              @click.stop="openListDlg"
            />
          </div>
        </div>

        <!-- Linked records modal -->
        <VirtualCellComponentsLinkRecordDropdown v-model:is-open="isOpen">
          <template #overlay>
            <VirtualCellComponentsLinkedItems
              v-if="childListDlg"
              v-model="childListDlg"
              :items="value?.value || 0"
              :column="linksRelatedTableDisplayColumn"
              :cell-value="[]"
              @attach-record="onAttachRecord"
              @escape="isOpen = false"
            />
            <VirtualCellComponentsUnLinkedItems
              v-if="listItemsDlg"
              v-model="listItemsDlg"
              :column="linksRelatedTableDisplayColumn"
              :hide-back-btn="false"
              @attach-linked-record="onAttachLinkedRecord"
              @escape="isOpen = false"
            />
          </template>
        </VirtualCellComponentsLinkRecordDropdown>
      </div>
    </template>
    <!-- Regular rollup display -->
    <div v-else>
      <CellDecimal v-if="renderAsTextFun.includes((colOptions as RollupType).rollup_function!)" :model-value="value" />
      <LazySmartsheetCell v-else v-model="value" :column="childColumn" :edit-enabled="false" :read-only="true" />
    </div>
    <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
      {{ $t('msg.info.computedFieldEditWarning') }}
    </div>
    <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
      {{ $t('msg.info.computedFieldDeleteWarning') }}
    </div>
  </div>
</template>
