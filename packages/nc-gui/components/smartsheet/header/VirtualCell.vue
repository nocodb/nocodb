<script setup lang="ts">
import {
  type ColumnReqType,
  type ColumnType,
  type FormulaType,
  type LinkToAnotherRecordType,
  type LookupType,
  type RollupType,
  isLinksOrLTAR,
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

const hideMenu = toRef(props, 'hideMenu')

const { isMobileMode } = useGlobal()

const editColumnDropdown = ref(false)

const isDropDownOpen = ref(false)

const isLocked = inject(IsLockedInj, ref(false))

provide(ColumnInj, column)

const { metas } = useMetas()

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const colOptions = computed(() => column.value?.colOptions)

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

const childColumn = computed(() => {
  if (relatedTableMeta.value?.columns) {
    if (isRollup(column.value)) {
      return relatedTableMeta.value?.columns.find(
        (c: ColumnType) => c.id === (colOptions.value as RollupType).fk_rollup_column_id,
      )
    }
    if (isLookup(column.value)) {
      return relatedTableMeta.value?.columns.find(
        (c: ColumnType) => c.id === (colOptions.value as LookupType).fk_lookup_column_id,
      )
    }
  }
  return ''
})

const tooltipMsg = computed(() => {
  if (!column.value) {
    return ''
  }

  if (isHm(column.value)) {
    return `'${tableTile.value}' ${t('labels.hasMany')} '${relatedTableTitle.value}'`
  } else if (isMm(column.value)) {
    return `'${tableTile.value}' & '${relatedTableTitle.value}' ${t('labels.manyToMany')}`
  } else if (isBt(column.value)) {
    return `'${column?.value?.title}' ${t('labels.belongsTo')} '${relatedTableTitle.value}'`
  } else if (isOo(column.value)) {
    return `'${tableTile.value}' & '${relatedTableTitle.value}' ${t('labels.oneToOne')}`
  } else if (isLookup(column.value)) {
    return `'${childColumn.value.title}' from '${relatedTableTitle.value}' (${childColumn.value.uidt})`
  } else if (isFormula(column.value)) {
    const formula = substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as FormulaType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    )
    return `Formula - ${formula}`
  } else if (isRollup(column.value)) {
    return `'${childColumn.value.title}' of '${relatedTableTitle.value}' (${childColumn.value.uidt})`
  }
  return column?.value?.title || ''
})

const showTooltipAlways = computed(() => {
  return isLinksOrLTAR(column.value) || isFormula(column.value) || isRollup(column.value) || isLookup(column.value)
})

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const columnTypeName = computed(() => {
  if (column.value.uidt === UITypes.LongText && parseProp(column?.value?.meta)?.richMode) {
    return UITypesName.RichText
  }
  if (column.value.uidt === UITypes.LinkToAnotherRecord && column.value.colOptions?.type === RelationTypes.ONE_TO_ONE) {
    return UITypesName[UITypes.Links]
  }

  return column.value.uidt ? UITypesName[column.value.uidt] : ''
})

const addField = async (payload: any) => {
  columnOrder.value = payload
  editColumnDropdown.value = true
}

const closeAddColumnDropdown = () => {
  columnOrder.value = null
  editColumnDropdown.value = false
}

const openHeaderMenu = (e?: MouseEvent) => {
  if (isLocked.value || (isExpandedForm.value && e?.type === 'dblclick')) return

  if (!isForm.value && isUIAllowed('fieldEdit') && !isMobileMode.value) {
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

const onClick = (e: Event) => {
  if (!isUIAllowed('fieldEdit')) return

  if (isDropDownOpen.value) {
    e.preventDefault()
    e.stopPropagation()
  } else {
    if (isExpandedForm.value && !editColumnDropdown.value) {
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
      'flex-col !items-start justify-center': isExpandedForm,
      'bg-gray-200': isExpandedForm ? editColumnDropdown || isDropDownOpen : false,
      'cursor-pointer hover:bg-gray-200': isExpandedForm && isUIAllowed('fieldEdit'),
    }"
    @dblclick="openHeaderMenu"
    @click.right="openDropDown"
    @click="onClick"
  >
    <div
      class="nc-virtual-cell-name-wrapper flex-1 flex items-center"
      :class="{
        'max-w-[calc(100%_-_23px)]': !isExpandedForm,
        'max-w-full': isExpandedForm,
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
          {{ tooltipMsg }}
        </template>
        <span
          :data-test-id="column.title"
          :class="{
            'select-none': isExpandedForm,
          }"
        >
          {{ column.title }}
        </span>
      </NcTooltip>

      <span v-if="isVirtualColRequired(column, meta?.columns || []) || required" class="text-red-500">&nbsp;*</span>

      <GeneralIcon
        v-if="isExpandedForm && isUIAllowed('fieldEdit')"
        icon="arrowDown"
        class="flex-none text-grey h-full text-grey cursor-pointer ml-1 group-hover:visible"
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
        @edit="editColumnDropdown = true"
      />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      class="h-full"
      :trigger="['click']"
      :placement="isExpandedForm ? 'bottomLeft' : 'bottomRight'"
      overlay-class-name="nc-dropdown-edit-column"
    >
      <div v-if="isExpandedForm" @dblclick.stop class="max-h-[0px] max-w-[0px]">&nbsp;</div>
      <div v-else />
      <template #overlay>
        <SmartsheetColumnEditOrAddProvider
          v-if="editColumnDropdown"
          :column="columnOrder ? null : column"
          :column-position="columnOrder"
          class="w-full"
          @submit="closeAddColumnDropdown"
          @cancel="closeAddColumnDropdown"
          @click.stop
          @keydown.stop
        />
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
