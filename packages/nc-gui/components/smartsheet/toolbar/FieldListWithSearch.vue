<script lang="ts" setup>
import { type ColumnType, isSystemColumn } from 'nocodb-sdk'

const props = defineProps<{
  // As we need to focus search box when the parent is opened
  isParentOpen: boolean
  toolbarMenu: 'groupBy' | 'sort' | 'globalSearch'
  searchInputPlaceholder?: string
  selectedOptionId?: string
  options: ColumnType[]
  showSelectedOption?: boolean
}>()

const emits = defineEmits<{ selected: [ColumnType] }>()

const { isParentOpen, toolbarMenu, searchInputPlaceholder, selectedOptionId, showSelectedOption } = toRefs(props)

const { fieldsMap, isLocalMode } = useViewColumnsOrThrow()

const options = computed(() =>
  (props.options || [])
    .filter((c) => (isLocalMode.value && c?.id && fieldsMap.value[c.id] ? fieldsMap.value[c.id]?.initialShow : true))
    .map((c) => c)
    .sort((field1, field2) => {
      // sort by view column order and keep system columns at the end
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
    }),
)

const configByToolbarMenu = computed(() => {
  switch (toolbarMenu.value) {
    case 'groupBy':
      return {
        selectOptionEvent: ['c:group-by:add:column:select'],
        optionClassName: 'nc-group-by-column-search-item',
      }
    case 'sort':
      return {
        selectOptionEvent: ['c:sort:add:column:select'],
        optionClassName: 'nc-sort-column-search-item',
      }
    case 'globalSearch':
      return {
        selectOptionEvent: ['c:search:field:select'],
        optionClassName: '',
      }
    default:
      return {
        selectOptionEvent: undefined,
        optionClassName: '',
      }
  }
})
</script>

<template>
  <NcListWithSearch
    :is-parent-open="isParentOpen"
    :search-input-placeholder="searchInputPlaceholder"
    :option-config="configByToolbarMenu"
    :options="options"
    :selected-option-id="selectedOptionId"
    filter-field="title"
    :show-selected-option="showSelectedOption"
    @selected="emits('selected', $event)"
  >
    <template #default="{ option }">
      <SmartsheetHeaderIcon :column="option" class="!w-3.5 !h-3.5 !text-gray-500" />
    </template>
  </NcListWithSearch>
</template>
