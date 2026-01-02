<script setup lang="ts">
import { UITypes, getRenderAsTextFunForUiType, PermissionEntity, PermissionKey } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, RollupType } from 'nocodb-sdk'
import RollupLinksProvider from './RollupLinksProvider.vue'

const { metas } = useMetas()

const value = inject(CellValueInj)

const column = inject(ColumnInj)!

const meta = inject(MetaInj, ref())

// Inject permission-related context that affects showAsLinks behavior
const readOnly = inject(ReadonlyInj, ref(false))
const isForm = inject(IsFormInj, ref(false))
const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const showAsLinks = computed(() => {
  return parseProp(column.value?.meta)?.showAsLinks || false
})

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning({
    disable: showAsLinks,
  })

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

// Determine the effective readonly state for showAsLinks
// When showing as links, inherit the same permission logic as Links component
const effectiveReadonly = computed(() => {
  if (!showAsLinks.value) return true // Regular rollup is always readonly

  // When showing as links, use the Links component's permission logic:
  // hasEditPermission = (!readOnly.value && isUIAllowed('dataEdit') && !isUnderLookup.value) || isForm.value
  // PLUS column-level permissions check
  const { isUIAllowed } = useRoles()
  const { isAllowed } = usePermissions()
  
  // Check both general dataEdit permission AND column-specific permission
  const hasGeneralEditPermission = (!readOnly.value && isUIAllowed('dataEdit') && !isUnderLookup.value) || isForm.value
  const hasColumnEditPermission = !column.value?.id || isAllowed(PermissionEntity.FIELD, column.value.id, PermissionKey.RECORD_FIELD_EDIT)
  
  const hasEditPermission = hasGeneralEditPermission && hasColumnEditPermission
  return !hasEditPermission // readonly is the inverse of hasEditPermission
})
</script>

<template>
  <div :class="{ 'w-full': showAsLinks && relationColumn }" @dblclick="activateShowEditNonEditableFieldWarning">
    <!-- Show as links when showAsLinks is enabled -->
    <template v-if="showAsLinks && relationColumn">
      <!-- Use Links cell component with relation column context and proper permission inheritance -->
      <RollupLinksProvider :relation-column="relationColumn" :readonly="effectiveReadonly" />
    </template>
    <!-- Regular rollup display -->
    <template v-else>
      <CellDecimal v-if="renderAsTextFun.includes((colOptions as RollupType).rollup_function!)" :model-value="value" />
      <LazySmartsheetCell v-else v-model="value" :column="childColumn" :edit-enabled="false" :read-only="true" />
      <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>
    </template>
  </div>
</template>
