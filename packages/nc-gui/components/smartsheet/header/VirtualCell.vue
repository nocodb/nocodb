<script setup lang="ts">
import {
  type ColumnReqType,
  type ColumnType,
  type FormulaType,
  type LinkToAnotherRecordType,
  type LookupType,
  type RollupType,
  isLinksOrLTAR,
  readonlyMetaAllowedTypes,
} from 'nocodb-sdk'
import { RelationTypes, UITypes, UITypesName, substituteColumnIdWithAliasInFormula } from 'nocodb-sdk'

const props = defineProps<{
  column: ColumnType
  hideMenu?: boolean
  required?: boolean | number
  hideIcon?: boolean
  isHiddenCol?: boolean
}>()

const { t } = useI18n()

const column = toRef(props, 'column')

const { base: activeBase, tables } = storeToRefs(useBase())

const isExternalSource = computed(() =>
  activeBase.value?.sources?.some((s) => s.id === column.value?.source_id && !s.is_meta && !s.is_local),
)

const hideMenu = toRef(props, 'hideMenu')

const { isMobileMode } = useGlobal()

const editColumnDropdown = ref(false)

const isDropDownOpen = ref(false)

const enableDescription = ref(false)

const isLocked = inject(IsLockedInj, ref(false))

provide(ColumnInj, column)

const { metas } = useMetas()

const { isUIAllowed, isMetaReadOnly } = useRoles()

const meta = inject(MetaInj, ref())

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isExpandedBulkUpdateForm = inject(IsExpandedBulkUpdateFormOpenInj, ref(false))

const tableTile = computed(() => meta?.value?.title)

const relationColumnOptions = computed<LinkToAnotherRecordType | null>(() => {
  if (isLinksOrLTAR(column.value)) {
    return column.value?.colOptions as LinkToAnotherRecordType
  } else if ((column?.value?.colOptions as LookupType | RollupType)?.fk_relation_column_id) {
    return meta?.value?.columns?.find(
      (c) => c.id === (column?.value?.colOptions as LookupType | RollupType)?.fk_relation_column_id,
    )?.colOptions as LinkToAnotherRecordType
  }
  return null
})

const relatedTableMeta = computed(
  () =>
    relationColumnOptions.value?.fk_related_model_id && metas.value?.[relationColumnOptions.value?.fk_related_model_id as string],
)

const relatedTableTitle = computed(() => relatedTableMeta.value?.title)

const tooltipMsg = computed(() => {
  if (!column.value) {
    return ''
  }

  let suffix = ''
  if (isLinksOrLTAR(column.value) && relatedTableTitle.value && isExternalSource.value) {
    if (isMm(column.value)) {
      const mmTableMeta =
        tables.value?.find((t) => t.id === column.value?.colOptions?.fk_mm_model_id) ||
        metas.value?.[column.value?.colOptions?.fk_mm_model_id as string]
      suffix = mmTableMeta ? `\nJunction Table: ${mmTableMeta.title}` : ''
    } else if (isHm(column.value)) {
      const fkColumn = metas.value?.[column.value?.colOptions?.fk_related_model_id as string]?.columns?.find(
        (c) => c.id === column.value?.colOptions?.fk_child_column_id,
      )
      suffix = fkColumn?.title?.startsWith('nc_') ? '' : `\nForeign Key Column: ${fkColumn.title}`
    } else if (isBt(column.value)) {
      const fkColumn = meta.value?.columns?.find((c) => c.id === column.value?.colOptions?.fk_child_column_id)
      suffix = fkColumn?.title?.startsWith('nc_') ? '' : `\nForeign Key Column: ${fkColumn.title}`
    }
  }

  if (isHm(column.value)) {
    return `'${tableTile.value}' ${t('labels.hasMany')} '${relatedTableTitle.value}'${suffix}`
  } else if (isMm(column.value)) {
    return `'${tableTile.value}' & '${relatedTableTitle.value}' ${t('labels.manyToMany')}${suffix}`
  } else if (isBt(column.value)) {
    return `'${column?.value?.title}' ${t('labels.belongsTo')} '${relatedTableTitle.value}'${suffix}`
  } else if (isOo(column.value)) {
    return `'${tableTile.value}' & '${relatedTableTitle.value}' ${t('labels.oneToOne')}${suffix}`
  } else if (isFormula(column.value)) {
    const formula = substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as FormulaType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    )
    return `Formula - ${formula}`
  }
  return column?.value?.title || ''
})

const showTooltipAlways = computed(() => {
  return isLinksOrLTAR(column.value) || isFormula(column.value)
})

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const columnTypeName = computed(() => {
  if (column.value.uidt === UITypes.LinkToAnotherRecord && column.value.colOptions?.type === RelationTypes.ONE_TO_ONE) {
    return UITypesName[UITypes.Links]
  }

  if (isAiButton(column.value)) {
    return UITypesName.AIButton
  }

  return column.value.uidt ? UITypesName[column.value.uidt] : ''
})

const addField = async (payload: any) => {
  columnOrder.value = payload
  editColumnDropdown.value = true
}

const editOrAddProviderRef = ref()

const closeAddColumnDropdown = () => {
  columnOrder.value = null
  editColumnDropdown.value = false
}

watch(editColumnDropdown, (val) => {
  if (!val) {
    enableDescription.value = false
  }
})

const openHeaderMenu = (e?: MouseEvent, description = false) => {
  if (isLocked.value || (isExpandedForm.value && e?.type === 'dblclick') || isExpandedBulkUpdateForm.value) return

  if (
    !isForm.value &&
    isUIAllowed('fieldEdit') &&
    !isMobileMode.value &&
    (!isMetaReadOnly.value || readonlyMetaAllowedTypes.includes(column.value.uidt))
  ) {
    if (description) {
      enableDescription.value = true
    }
    editColumnDropdown.value = true
  }
}

const openDropDown = (e: Event) => {
  if (isLocked.value) return

  if (isForm.value || (!isUIAllowed('fieldEdit') && !isMobileMode.value)) return

  e.preventDefault()
  e.stopPropagation()

  isDropDownOpen.value = !isDropDownOpen.value
}

const onVisibleChange = () => {
  editColumnDropdown.value = true
  if (!editOrAddProviderRef.value?.shouldKeepModalOpen()) {
    editColumnDropdown.value = false
    enableDescription.value = false
  }
}

const onClick = (e: Event) => {
  if (isMobileMode.value || !isUIAllowed('fieldEdit')) return

  if (isDropDownOpen.value) {
    e.preventDefault()
    e.stopPropagation()
  } else {
    if (isExpandedForm.value && !editColumnDropdown.value && !isExpandedBulkUpdateForm.value) {
      isDropDownOpen.value = true
      return
    }
  }

  isDropDownOpen.value = false
}
</script>

<template>
  <div
    class="flex items-center w-full h-full text-small text-gray-500 font-weight-medium group"
    :class="{
      'flex-col !items-start justify-center pt-0.5': isExpandedForm && !isMobileMode && !isExpandedBulkUpdateForm,
      'bg-gray-100': isExpandedForm && !isExpandedBulkUpdateForm ? editColumnDropdown || isDropDownOpen : false,
      'nc-cell-expanded-form-header cursor-pointer hover:bg-gray-100':
        isExpandedForm && !isMobileMode && isUIAllowed('fieldEdit') && !isExpandedBulkUpdateForm,
    }"
    @dblclick="openHeaderMenu"
    @click.right="openDropDown"
    @click="onClick"
  >
    <div
      class="nc-virtual-cell-name-wrapper flex-1 flex items-center"
      :class="{
        'max-w-[calc(100%_-_23px)]': !isExpandedForm && !column.description?.length,
        'max-w-[calc(100%_-_44px)]': !isExpandedForm && column.description?.length,
        'max-w-full': isExpandedForm && !isExpandedBulkUpdateForm,
      }"
    >
      <template v-if="column && !props.hideIcon">
        <NcTooltip v-if="isGrid" class="flex items-center" placement="bottom">
          <template #title> {{ columnTypeName }} </template>
          <LazySmartsheetHeaderVirtualCellIcon />
        </NcTooltip>
        <LazySmartsheetHeaderVirtualCellIcon v-else />
      </template>
      <NcTooltip placement="bottom" class="truncate name pl-1" :show-on-truncate-only="!showTooltipAlways">
        <template #title>
          <template v-for="(msg, i) in tooltipMsg.split('\n')" :key="i">
            <div>{{ msg }}</div>
          </template>
        </template>
        <span
          :data-test-id="column.title"
          :class="{
            'select-none': isExpandedForm && !isExpandedBulkUpdateForm,
          }"
        >
          {{ column.title }}
        </span>
      </NcTooltip>

      <span v-if="isVirtualColRequired(column, meta?.columns || []) || required" class="text-red-500">&nbsp;*</span>
      <GeneralIcon
        v-if="isExpandedForm && !isMobileMode && isUIAllowed('fieldEdit') && !isExpandedBulkUpdateForm"
        icon="arrowDown"
        class="flex-none cursor-pointer ml-1 group-hover:visible w-4 h-4"
        :class="{
          visible: editColumnDropdown || isDropDownOpen,
          invisible: !(editColumnDropdown || isDropDownOpen),
        }"
      />
    </div>
    <template v-if="!hideMenu">
      <div v-if="!isExpandedForm" class="flex-1" />

      <LazySmartsheetHeaderMenu
        v-if="!isForm && isUIAllowed('fieldEdit')"
        v-model:is-open="isDropDownOpen"
        :is-hidden-col="isHiddenCol"
        :virtual="true"
        @add-column="addField"
        @edit="openHeaderMenu"
      />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      class="h-full"
      :trigger="['click']"
      :placement="isExpandedForm && !isExpandedBulkUpdateForm ? 'bottomLeft' : 'bottomRight'"
      :overlay-class-name="`nc-dropdown-edit-column ${editColumnDropdown ? 'active' : ''}`"
      @visible-change="onVisibleChange"
    >
      <div v-if="isExpandedForm && !isExpandedBulkUpdateForm" class="h-[1px]" @dblclick.stop>&nbsp;</div>
      <div v-else />
      <template #overlay>
        <div class="nc-edit-or-add-provider-wrapper">
          <LazySmartsheetColumnEditOrAddProvider
            v-if="editColumnDropdown"
            ref="editOrAddProviderRef"
            :column="columnOrder ? null : column"
            :column-position="columnOrder"
            class="w-full"
            :edit-description="enableDescription"
            @submit="closeAddColumnDropdown"
            @cancel="closeAddColumnDropdown"
            @click.stop
            @keydown.stop
          />
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  word-break: break-all;
}
</style>
