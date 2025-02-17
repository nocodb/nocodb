<script lang="ts" setup>
import { type ColumnType, type TableType, UITypes, isHiddenCol, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import FieldElement from './FieldElement.vue'

const props = defineProps<{
  relatedTableMeta?: TableType
}>()

const selectedFields = defineModel<string[]>({ required: true })
const showSystemFields = ref(false)
const filterQuery = ref('')

const fieldsToIgnore = new Set([
  UITypes.Button,
  UITypes.GeoData,
  UITypes.Geometry,
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
])
const columns = computed(() =>
  (props.relatedTableMeta?.columns ?? [])
    .filter((column) => !fieldsToIgnore.has(column.uidt as UITypes) && !isSystemColumn(column) && !isLinksOrLTAR(column))
    .sort((a, b) => {
      return (parseProp(a.meta)?.defaultViewColOrder ?? Infinity) - (parseProp(b.meta)?.defaultViewColOrder ?? Infinity)
    }),
)

const metaColumnById = computed(() =>
  columns.value.reduce((map, column) => {
    map[column.id!] = parseProp(column)
    return map
  }, {} as Record<string, Record<string, any>>),
)

const isOpen = ref(false)

const fieldById = computed(() =>
  columns.value.reduce<Record<string, any>>((acc, curr) => {
    acc[curr.id ?? ''] = curr
    return acc
  }, {}),
)

const fields = computed(() => {
  return columns.value.map((column: ColumnType) => {
    const currentColumnField = fieldById.value[column.id!] || {}

    return {
      title: column.title,
      fk_column_id: column.id,
      ...currentColumnField,
      system: isSystemColumn(metaColumnById?.value?.[currentColumnField.fk_column_id!]),
      initialShow: true,
    }
  })
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

function isChecked(field: ColumnType) {
  return selectedFields.value.includes(field.id!)
}

function updateChecked(checked: boolean, field: ColumnType) {
  if (checked) {
    selectedFields.value.push(field.id!)
  } else if (selectedFields.value.length !== 1) {
    const idx = selectedFields.value.indexOf(field.id!)
    if (idx !== -1) selectedFields.value.splice(idx, 1)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen">
    <div
      class="text-nc-fill-primary text-[13px] font-700 flex gap-2 items-center p-2 border-t-1 border-nc-border-gray-medium cursor-pointer"
    >
      <GeneralIcon icon="ncPlus"></GeneralIcon>
      Add Column
    </div>
    <template #overlay>
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
              <FieldElement
                :field="field"
                :icon="getIcon(metaColumnById[field.id]!)"
                @click.stop="updateChecked(!isChecked(field), field)"
              >
                <template #suffixIcon>
                  <a-checkbox
                    :disabled="selectedFields.length === 1 && isChecked(field)"
                    :checked="isChecked(field)"
                    @click.stop
                    @update:checked="(checked) => updateChecked(checked, field)"
                  />
                </template>
              </FieldElement>
            </template>
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.field-elements {
  :deep(.nc-field-elements-search.ant-input-affix-wrapper) {
    @apply !border-none !shadow-none;
  }
  :deep(.nc-field-elements-search .ant-input::placeholder) {
    @apply text-gray-500;
  }
  :deep(.nc-field-elements-search input) {
    @apply !rounded-none caret-nc-fill-primary;
  }
  :deep(.field-element .truncate) {
    font-weight: 700;
  }
}
</style>
