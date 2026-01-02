<script setup lang="ts">
import { UITypes, getRenderAsTextFunForUiType } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, RollupType } from 'nocodb-sdk'

const { metas } = useMetas()

const value = inject(CellValueInj)

const column = inject(ColumnInj)!

const meta = inject(MetaInj, ref())

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

// When showing as links, we need to control the readonly state
// If enableLinkActions is false, make it readonly to prevent editing
// but still allow viewing linked records
const readOnlyForLinks = computed(() => {
  if (!showAsLinks.value) {
    // Not showing as links, use the current readonly state
    const currentReadonly = inject(ReadonlyInj, ref(false))
    return currentReadonly.value
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
  const parsedValue = +value?.value || 0
  const columnMeta = parseProp(column.value?.meta)

  if (!parsedValue) {
    return 'No records linked'
  } else if (parsedValue === 1) {
    return `1 ${columnMeta?.singular || 'record'}`
  } else {
    return `${parsedValue} ${columnMeta?.plural || 'records'}`
  }
})

// Set up the LTAR store for the relation column when showing as links
const {
  relatedTableMeta: linksRelatedTableMeta,
  loadRelatedTableMeta: loadLinksRelatedTableMeta,
  relatedTableDisplayValueProp: linksRelatedTableDisplayValueProp
} = useProvideLTARStore(
  relationColumn as Ref<Required<ColumnType>>,
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

const openLinkedRecords = () => {
  if (!relationColumn.value) return

  childListDlg.value = true
  isOpen.value = true
}

// Watch for modal close
watch(isOpen, (next) => {
  if (!next) {
    childListDlg.value = false
  }
}, { flush: 'post' })
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
            @keydown.enter.stop="openLinkedRecords"
          >
            <MdiPlus
              class="select-none !text-md text-gray-700 nc-action-icon nc-plus invisible group-hover:visible group-focus:visible"
              @click.stop="openLinkedRecords"
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
