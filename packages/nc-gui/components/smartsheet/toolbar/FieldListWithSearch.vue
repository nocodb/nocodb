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

const { $e } = useNuxtApp()

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
        selectOptionEvent: 'c:group-by:add:column:select',
        optionClassName: 'nc-group-by-column-search-item',
      }
    case 'sort':
      return {
        selectOptionEvent: 'c:sort:add:column:select',
        optionClassName: 'nc-sort-column-search-item',
      }
    case 'globalSearch':
      return {
        selectOptionEvent: 'c:search:field:select',
        optionClassName: '',
      }
    default:
      return {
        selectOptionEvent: undefined,
        optionClassName: '',
      }
  }
})

const handleSelect = (c: ColumnType) => {
  emits('selected', c)
  if (configByToolbarMenu.value.selectOptionEvent) {
    $e(configByToolbarMenu.value.selectOptionEvent)
  }
}

const isLocked = inject(IsLockedInj)
</script>

<template>
  <NcList
    class="field-list-with-search"
    :search-input-placeholder="searchInputPlaceholder"
    :show-selected-option="showSelectedOption"
    option-label-key="title"
    option-value-key="id"
    :input-bordered="true"
    :open="isParentOpen"
    :is-locked="isLocked"
    show-search-always
    :item-class-name="configByToolbarMenu.optionClassName"
    :list="options"
    :value="selectedOptionId"
    :item-height="32"
    @change="handleSelect"
  >
    <template #listItemExtraLeft="{ option }">
      <SmartsheetHeaderIcon :column="option" class="!w-3.5 !h-3.5 !text-gray-500" />
    </template>
  </NcList>
</template>

<style lang="scss">
.field-list-with-search {
  .nc-divider {
    display: none !important;
  }

  .nc-toolbar-dropdown-search-field-input {
    @apply rounded-lg mb-2;
  }

  .nc-list-item {
    @apply h-8 hover:bg-nc-background-grey-light gap-x-1.5;
  }
}
</style>
