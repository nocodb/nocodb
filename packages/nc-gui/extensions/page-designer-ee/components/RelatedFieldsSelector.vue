<script lang="ts" setup>
import { type ColumnType, type TableType, UITypes, isHiddenCol, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import FieldElement from './FieldElement.vue'
import Draggable from 'vuedraggable'

const props = defineProps<{
  relatedTableMeta?: TableType
}>()

const selectedFields = defineModel<{ id: string; selected: boolean }[]>({ required: true })
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
    map[column.id!] = column
    return map
  }, {} as Record<string, ColumnType>),
)

const fields = computed(() => {
  return columns.value.map((column: ColumnType) => {
    const currentColumnField = metaColumnById.value[column.id!] || {}

    return {
      title: column.title,
      fk_column_id: column.id,
      ...currentColumnField,
      system: isSystemColumn(metaColumnById?.value?.[currentColumnField.fk_column_id!]),
      initialShow: true,
    }
  })
})

const filteredFieldSet = computed(() => {
  return new Set(
    (
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
    ).map((col) => col.id),
  )
})

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

const selectedMap = computed(() => {
  return selectedFields.value.reduce((map, col) => {
    map[col.id] = col.selected
    return map
  }, {} as Record<string, boolean>)
})

function isChecked(fieldId: string) {
  return !!selectedMap.value[fieldId]
}

const selectedFieldsCount = computed(() => Object.values(selectedMap.value).filter((v) => v).length)
const isSingleFieldSelected = computed(() => selectedFieldsCount.value === 1)

function updateChecked(checked: boolean, fieldId: string) {
  const idx = selectedFields.value.findIndex((col) => col.id === fieldId)
  if (idx === -1 || (isSingleFieldSelected.value && !checked)) return
  selectedFields.value.splice(idx, 1, { id: fieldId, selected: checked })
}

whenever(
  () => selectedFieldsCount.value === 0,
  () => {
    const idx = selectedFields.value.findIndex((col) => metaColumnById.value[col.id]?.pv)
    if (idx !== -1) {
      const field = selectedFields.value[idx]
      if (!field) return
      selectedFields.value.splice(idx, 1, { id: field.id, selected: true })
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="field-elements rounded-lg">
    <div class="py-1">
      <a-input
        v-model:value="filterQuery"
        :placeholder="$t('placeholder.searchFields')"
        class="nc-field-elements-search !h-[26px]"
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
          v-if="filterQuery.length && !filteredFieldSet.size"
          class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center"
        >
          <img
            src="~assets/img/placeholder/no-search-result-found.png"
            class="!w-[164px] flex-none"
            alt="No search results found"
          />

          {{ $t('title.noResultsMatchedYourSearch') }}
        </div>
        <Draggable v-model="selectedFields" handle=".cursor-move">
          <template #item="{ element: field }">
            <FieldElement
              v-show="filteredFieldSet.has(field.id)"
              :field="metaColumnById[field.id]!"
              :icon="getIcon(metaColumnById[field.id]!)"
              display-drag-handle
              @click.stop="updateChecked(!isChecked(field.id), field.id)"
            >
              <template #suffixIcon>
                <NcSwitch :disabled="isSingleFieldSelected && isChecked(field.id)" :checked="isChecked(field.id)" size="xsmall" />
              </template>
            </FieldElement>
          </template>
        </Draggable>
      </div>
    </div>
  </div>
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
