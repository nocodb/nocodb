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

const { fieldsMap } = useViewColumnsOrThrow()

const searchQuery = ref('')

const options = computed(() =>
  (props.options || [])
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

const filteredOptions = computed(
  () => options.value?.filter((c: ColumnType) => c.title?.toLowerCase().includes(searchQuery.value.toLowerCase())) ?? [],
)

const inputRef = ref()

const activeFieldIndex = ref(-1)

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

const onClick = (column: ColumnType) => {
  if (!column) return

  emits('selected', column)
}

const handleAutoScrollOption = () => {
  const option = document.querySelector('.nc-field-list-option-active')

  if (option) {
    setTimeout(() => {
      option?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }
}

const onArrowDown = () => {
  activeFieldIndex.value = Math.min(activeFieldIndex.value + 1, filteredOptions.value.length - 1)
  handleAutoScrollOption()
}

const onArrowUp = () => {
  activeFieldIndex.value = Math.max(activeFieldIndex.value - 1, 0)
  handleAutoScrollOption()
}

const handleKeydownEnter = () => {
  if (filteredOptions.value[activeFieldIndex.value]) {
    onClick(filteredOptions.value[activeFieldIndex.value])
  } else if (filteredOptions.value[0]) {
    onClick(filteredOptions.value[activeFieldIndex.value])
  }
}

onMounted(() => {
  searchQuery.value = ''
  activeFieldIndex.value = -1
})

watch(
  isParentOpen,
  () => {
    if (!isParentOpen.value) return

    searchQuery.value = ''
    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    class="flex flex-col pt-2 w-64"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="onClick(filteredOptions[activeFieldIndex])"
  >
    <div class="w-full pb-2 px-2" @click.stop>
      <a-input
        ref="inputRef"
        v-model:value="searchQuery"
        :placeholder="searchInputPlaceholder || $t('placeholder.searchFields')"
        class="nc-toolbar-dropdown-search-field-input"
        @keydown.enter.stop="handleKeydownEnter"
        @change="activeFieldIndex = 0"
      >
        <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
      ></a-input>
    </div>

    <div class="nc-field-list-wrapper flex-col w-full max-h-100 nc-scrollbar-thin !overflow-y-auto px-2 pb-2">
      <div v-if="!filteredOptions.length" class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6">
        <img
          src="~assets/img/placeholder/no-search-result-found.png"
          class="!w-[164px] flex-none"
          alt="No search results found"
        />

        {{ options.length ? $t('title.noResultsMatchedYourSearch') : 'The list is empty' }}
      </div>

      <div
        v-for="(option, index) in filteredOptions"
        :key="index"
        v-e="configByToolbarMenu.selectOptionEvent"
        class="flex w-full py-[5px] items-center justify-between px-2 hover:bg-gray-100 cursor-pointer rounded-md"
        :class="[
          `${configByToolbarMenu.optionClassName}`,
          `nc-field-list-option-${index}`,
          {
            'bg-gray-100 nc-field-list-option-active': activeFieldIndex === index,
          },
        ]"
        @click="onClick(option)"
      >
        <div
          class="flex items-center gap-x-1.5"
          :class="{
            'max-w-[calc(100%_-_28px)]': showSelectedOption,
            'max-w-full': !showSelectedOption,
          }"
        >
          <SmartsheetHeaderIcon :column="option" class="!w-3.5 !h-3.5 !text-gray-500" />
          <NcTooltip class="truncate" show-on-truncate-only>
            <template #title> {{ option.title }}</template>
            <span>
              {{ option.title }}
            </span>
          </NcTooltip>
        </div>

        <GeneralIcon
          v-if="showSelectedOption && option.id === selectedOptionId"
          id="nc-selected-item-icon"
          icon="check"
          class="flex-none text-primary w-4 h-4"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-field-list-wrapper {
  max-height: min(400px, calc(100vh - 120px));
}
</style>
