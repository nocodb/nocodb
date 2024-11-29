<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isHiddenCol, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

const { modelValue, isSort, allowEmpty, ...restProps } = defineProps<{
  modelValue?: string
  isSort?: boolean
  columns?: ColumnType[]
  allowEmpty?: boolean
  meta: TableType
}>()

const emit = defineEmits(['update:modelValue'])

const customColumns = toRef(restProps, 'columns')

const meta = toRef(restProps, 'meta')

const fieldNameAlias = inject(FieldNameAlias, ref({} as Record<string, string>))

const { metas } = useMetas()

const localValue = computed({
  get: () => modelValue,
  set: (val) => emit('update:modelValue', val),
})

const { showSystemFields, metaColumnById, fieldsMap, isLocalMode } = useViewColumnsOrThrow()

const options = computed<SelectProps['options']>(() =>
  (
    customColumns.value?.filter((c: ColumnType) => {
      if (
        isLocalMode.value &&
        c?.id &&
        fieldsMap.value[c.id] &&
        (!fieldsMap.value[c.id]?.initialShow || (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[c.id!])))
      ) {
        return false
      }

      if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
        if (isHiddenCol(c, meta.value)) {
          /** ignore mm relation column, created by and last modified by system field */
          return false
        }
      }
      if (c.uidt === UITypes.Button) return false
      return true
    }) ||
    meta.value?.columns?.filter((c: ColumnType) => {
      if (
        isLocalMode.value &&
        c?.id &&
        fieldsMap.value[c.id] &&
        (!fieldsMap.value[c.id]?.initialShow || (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[c.id!])))
      ) {
        return false
      }

      if (c.uidt === UITypes.Links) {
        return true
      }
      if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
        if (isHiddenCol(c, meta.value)) {
          /** ignore mm relation column, created by and last modified by system field */
          return false
        }

        return (
          /** if the field is used in filter, then show it anyway */
          localValue.value === c.id ||
          /** hide system columns if not enabled */
          showSystemFields.value
        )
      } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID || c.uidt === UITypes.Button) {
        return false
      } else if (isSort) {
        /** ignore hasmany and manytomany relations if it's using within sort menu */
        return !(isLinksOrLTAR(c) && (c.colOptions as LinkToAnotherRecordType).type !== RelationTypes.BELONGS_TO)
        /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
      } else {
        const isVirtualSystemField = c.colOptions && c.system
        return !isVirtualSystemField
      }
    })
  )
    // sort by view column order and keep system columns at the end
    ?.sort((field1, field2) => {
      let orderVal1 = 0
      let orderVal2 = 0
      let sortByOrder = 0

      if (isSystemColumn(field1)) {
        orderVal1 = 1
      }
      if (isSystemColumn(field2)) {
        orderVal2 = 1
      }

      if (
        field1?.id &&
        field2?.id &&
        fieldsMap.value[field1.id]?.order !== undefined &&
        fieldsMap.value[field2.id]?.order !== undefined
      ) {
        sortByOrder = fieldsMap.value[field1.id].order - fieldsMap.value[field2.id].order
      }

      return orderVal1 - orderVal2 || sortByOrder
    })
    ?.map((c: ColumnType) => ({
      value: c.id,
      label: fieldNameAlias.value[c.id!] || c.title,
      icon: h(
        isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'),
        {
          columnMeta: c,
        },
      ),
      c,
    })),
)

const filterOption = (input: string, option: any) => option.label.toLowerCase()?.includes(input.toLowerCase())

// when a new filter is created, select a field by default
if (!localValue.value && allowEmpty !== true) {
  localValue.value = (options.value?.[0]?.value as string) || ''
}

const relationColor = {
  [RelationTypes.BELONGS_TO]: 'text-blue-500',
  [RelationTypes.ONE_TO_ONE]: 'text-purple-500',
  [RelationTypes.HAS_MANY]: 'text-orange-500',
  [RelationTypes.MANY_TO_MANY]: 'text-pink-500',
}

// extract colors for Lookup and Rollup columns
const colors = computed(() => {
  return (
    meta.value?.columns?.reduce((obj, col) => {
      if ((col && isLookup(col)) || isRollup(col)) {
        const relationColumn = metas.value?.[meta.value.id]?.columns?.find(
          (c) => c.id === col.colOptions?.fk_relation_column_id,
        ) as ColumnType

        if (relationColumn) {
          obj[col.id] = relationColor[relationColumn.colOptions?.type as RelationTypes]
        }
      }
      return obj
    }, {}) || {}
  )
})
</script>

<template>
  <NcSelect
    v-model:value="localValue"
    :dropdown-match-select-width="false"
    show-search
    :placeholder="$t('placeholder.selectField')"
    :filter-option="filterOption"
    dropdown-class-name="nc-dropdown-toolbar-field-list"
  >
    <a-select-option v-for="option in options" :key="option.value" :label="option.label" :value="option.value">
      <div class="flex items-center w-full justify-between w-full gap-2 max-w-50">
        <div class="flex gap-1.5 flex-1 items-center truncate items-center h-full">
          <component :is="option.icon" class="!w-3.5 !h-3.5 !mx-0" :class="colors[option.value] || '!text-gray-500'" />
          <NcTooltip
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            class="max-w-[15rem] truncate select-none"
            show-on-truncate-only
          >
            <template #title> {{ option.label }}</template>
            <span>
              {{ option.label }}
            </span>
          </NcTooltip>
        </div>
        <component
          :is="iconMap.check"
          v-if="localValue === option.value"
          id="nc-selected-item-icon"
          class="text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NcSelect>
</template>

<style lang="scss">
.ant-select-selection-search-input {
  box-shadow: none !important;
}
</style>
