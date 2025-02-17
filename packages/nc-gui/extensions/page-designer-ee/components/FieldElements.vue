<script lang="ts" setup>
import { type ColumnType, UITypes, isHiddenCol, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { PageDesignerRowInj, PageDesignerTableTypeInj } from '../lib/context'
import FieldElement from './FieldElement.vue'

const meta = inject(PageDesignerTableTypeInj)
const row = inject(PageDesignerRowInj)!

const { metaColumnById } = useViewColumnsOrThrow()

const showSystemFields = ref(false)
const filterQuery = ref('')

const fieldsToIgnore = new Set([UITypes.Button, UITypes.GeoData, UITypes.Geometry, UITypes.Lookup, UITypes.Rollup])
const columns = computed(() =>
  (meta?.value?.columns ?? []).filter(
    (column) => !fieldsToIgnore.has(column.uidt as UITypes) && row.value && !isRowEmpty(row.value, column),
  ),
)

const fieldById = computed(() =>
  columns.value.reduce<Record<string, any>>((acc, curr) => {
    acc[curr.id ?? ''] = curr
    return acc
  }, {}),
)

const fields = computed(() => {
  return (
    columns.value
      ?.filter((column: ColumnType) => {
        // filter created by and last modified by system columns
        if (isHiddenCol(column, meta.value)) return false
        return true
      })
      .map((column: ColumnType) => {
        const currentColumnField = fieldById.value[column.id!] || {}

        return {
          title: column.title,
          fk_column_id: column.id,
          ...currentColumnField,
          system: isSystemColumn(metaColumnById?.value?.[currentColumnField.fk_column_id!]),
          initialShow: true,
        }
      })
      .sort((a: Field, b: Field) => a.order - b.order) ?? []
  )
})

const filteredFieldList = computed(() => {
  return (
    fields.value?.filter((field: Field) => {
      if (!field.initialShow) {
        return false
      }

      if (
        metaColumnById?.value?.[field.fk_column_id!]?.pv &&
        (!filterQuery.value || field.title.toLowerCase().includes(filterQuery.value.toLowerCase()))
      ) {
        return true
      }

      // hide system columns if not enabled
      if (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[field.fk_column_id!])) {
        return false
      }

      if (filterQuery.value === '') {
        return true
      } else {
        return field.title.toLowerCase().includes(filterQuery.value.toLowerCase())
      }
    }) || []
  )
})

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })
</script>

<template>
  <div class="field-elements rounded-lg">
    <div class="py-1">
      <a-input
        v-model:value="filterQuery"
        :placeholder="$t('placeholder.searchFields')"
        class="nc-field-elements-search !h-[34px]"
      >
        <template #prefix> <GeneralIcon icon="ncSearch" class="mr-2" /> </template>
      </a-input>
    </div>

    <div
      class="flex flex-col nc-scrollbar-thin max-h-[205px] overflow-y-auto border-t-1 border-nc-border-gray-medium"
      style="scrollbar-gutter: stable !important"
    >
      <div>
        <div
          v-if="filterQuery.length && !filteredFieldList.length"
          class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center"
        >
          <img
            src="~assets/img/placeholder/no-search-result-found.png"
            class="!w-[164px] flex-none"
            alt="No search results found"
          />

          {{ $t('title.noResultsMatchedYourSearch') }}
        </div>

        <template v-for="field in filteredFieldList" :key="field.id">
          <FieldElement :field="field" :icon="getIcon(metaColumnById[field.fk_column_id])" />
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.field-elements {
  @apply border-1 border-solid border-nc-border-gray-medium;
  :deep(.nc-field-elements-search.ant-input-affix-wrapper) {
    @apply !border-none !shadow-none;
  }
  :deep(.nc-field-elements-search .ant-input::placeholder) {
    @apply text-gray-500;
  }
  :deep(.nc-field-elements-search input) {
    @apply !rounded-none caret-nc-fill-primary;
  }
}
</style>
