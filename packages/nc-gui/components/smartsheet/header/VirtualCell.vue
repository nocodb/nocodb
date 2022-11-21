<script setup lang="ts">
import type { ColumnType, FormulaType, LinkToAnotherRecordType, LookupType, RollupType } from 'nocodb-sdk'
import { substituteColumnIdWithAliasInFormula } from 'nocodb-sdk'
import {
  ColumnInj,
  IsFormInj,
  MetaInj,
  computed,
  inject,
  isBt,
  isFormula,
  isHm,
  isLookup,
  isMm,
  isRollup,
  isVirtualColRequired,
  provide,
  ref,
  toRef,
  useI18n,
  useMetas,
  useUIPermission,
} from '#imports'

const props = defineProps<{ column: ColumnType; hideMenu?: boolean; required?: boolean | number }>()

const { t } = useI18n()

const column = toRef(props, 'column')

const hideMenu = toRef(props, 'hideMenu')

const editColumnDropdown = ref(false)

provide(ColumnInj, column)

const { metas } = useMetas()

const { isUIAllowed } = useUIPermission()

const meta = inject(MetaInj, ref())

const isForm = inject(IsFormInj, ref(false))

const colOptions = $computed(() => column.value?.colOptions)

const tableTile = $computed(() => meta?.value?.title)

const relationColumnOptions = $computed<LinkToAnotherRecordType | null>(() => {
  if (isMm(column.value) || isHm(column.value) || isBt(column.value)) {
    return column.value?.colOptions as LinkToAnotherRecordType
  } else if ((column?.value?.colOptions as LookupType | RollupType)?.fk_relation_column_id) {
    return meta?.value?.columns?.find(
      (c) => c.id === (column?.value?.colOptions as LookupType | RollupType)?.fk_relation_column_id,
    )?.colOptions as LinkToAnotherRecordType
  }
  return null
})

const relatedTableMeta = $computed(
  () => relationColumnOptions?.fk_related_model_id && metas.value?.[relationColumnOptions?.fk_related_model_id as string],
)

const relatedTableTitle = $computed(() => relatedTableMeta?.title)

const childColumn = $computed(() => {
  if (relatedTableMeta?.columns) {
    if (isRollup(column.value)) {
      return relatedTableMeta?.columns.find((c: ColumnType) => c.id === (colOptions as RollupType).fk_rollup_column_id)
    }
    if (isLookup(column.value)) {
      return relatedTableMeta?.columns.find((c: ColumnType) => c.id === (colOptions as LookupType).fk_lookup_column_id)
    }
  }
  return ''
})

const tooltipMsg = computed(() => {
  if (!column.value) {
    return ''
  }
  if (isHm(column.value)) {
    return `'${tableTile}' ${t('labels.hasMany')} '${relatedTableTitle}'`
  } else if (isMm(column.value)) {
    return `'${tableTile}' & '${relatedTableTitle}' ${t('labels.manyToMany')}`
  } else if (isBt(column.value)) {
    return `'${column?.value?.title}' ${t('labels.belongsTo')} '${relatedTableTitle}'`
  } else if (isLookup(column.value)) {
    return `'${childColumn.title}' from '${relatedTableTitle}' (${childColumn.uidt})`
  } else if (isFormula(column.value)) {
    const formula = substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as FormulaType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    )
    return `Formula - ${formula}`
  } else if (isRollup(column.value)) {
    return `'${childColumn.title}' of '${relatedTableTitle}' (${childColumn.uidt})`
  }
  return ''
})
</script>

<template>
  <div class="flex items-center w-full text-xs text-gray-500 font-weight-medium" :class="{ 'h-full': column }">
    <LazySmartsheetHeaderVirtualCellIcon v-if="column" />

    <a-tooltip placement="bottom">
      <template #title>
        {{ tooltipMsg }}
      </template>
      <span class="name" style="white-space: nowrap" :title="column.title"> {{ column.title }}</span>
    </a-tooltip>

    <span v-if="isVirtualColRequired(column, meta.columns) || required" class="text-red-500">&nbsp;*</span>

    <template v-if="!hideMenu">
      <div class="flex-1" />

      <LazySmartsheetHeaderMenu v-if="!isForm && isUIAllowed('edit-column')" :virtual="true" @edit="editColumnDropdown = true" />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      class="h-full"
      :trigger="['click']"
      placement="bottomRight"
      overlay-class-name="nc-dropdown-edit-column"
    >
      <div />

      <template #overlay>
        <SmartsheetColumnEditOrAddProvider
          v-if="editColumnDropdown"
          :column="column"
          class="w-full"
          @submit="editColumnDropdown = false"
          @cancel="editColumnDropdown = false"
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
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
