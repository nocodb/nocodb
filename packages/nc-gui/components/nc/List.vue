<script lang="ts" setup>
export type Placement = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'

export type RawValueType = string | number

interface ListItem {
  value?: RawValueType
  label?: string
  [key: string]: any
}

/**
 * Props interface for the List component
 */
interface Props {
  /** The currently selected value */
  value: RawValueType
  /** The list of items to display */
  list: ListItem[]
  /**
   * The key to use for accessing the value from a list item
   * @default 'value'
   */
  optionValueKey?: string
  /**
   * The key to use for accessing the label from a list item
   * @default 'label'
   */
  optionLabelKey?: string
  /** Whether the list is open or closed */
  open?: boolean
  /** Whether to close the list after an item is selected */
  closeOnSelect?: boolean
  /** Placeholder text for the search input */
  searchInputPlaceholder?: string
  /** Whether to show the currently selected option */
  showSelectedOption?: boolean
  /** Custom filter function for list items */
  filterOption?: (input: string, option: ListItem, index: Number) => boolean
}

interface Emits {
  (e: 'update:value', value: RawValueType): void
  (e: 'update:open', open: boolean): void
  (e: 'change', option: ListItem): void
}

const emits = defineEmits<Emits>()

const props = withDefaults(defineProps<Props>(), {
  open: false,
  closeOnSelect: true,
  showSelectedOption: true,
  optionValueKey: 'value',
  optionLabelKey: 'label',
})

const vModel = useVModel(props, 'value', emits)

const vOpen = useVModel(props, 'open', emits)

const { optionValueKey, optionLabelKey } = props

const { closeOnSelect, showSelectedOption } = toRefs(props)

const listRef = ref<HTMLDivElement>()

const searchQuery = ref('')

const inputRef = ref()

const activeOptionIndex = ref(-1)

const showHoverEffectOnSelectedOption = ref(true)

const isSearchEnabled = computed(() => props.list.length > 4)

/**
 * Computed property that filters the list of options based on the search query
 * If a custom filter function is provided via props.filterOption, it will be used instead of the default filtering logic
 * @returns {ListItem[]} Filtered list of options
 */
const list = computed(() => {
  return props.list.filter((item, i) => {
    if (props?.filterOption) {
      return props.filterOption(searchQuery.value, item, i)
    } else {
      return item[optionLabelKey]?.toLowerCase()?.includes(searchQuery.value.toLowerCase())
    }
  })
})

/**
 * Resets the hover effect on the selected option
 * @param clearActiveOption - Whether to clear the active option index
 */
const handleResetHoverEffect = (clearActiveOption = false) => {
  if (clearActiveOption) {
    activeOptionIndex.value = -1
  }

  if (!showHoverEffectOnSelectedOption.value) return

  showHoverEffectOnSelectedOption.value = false
}

/**
 * Handles the selection of an option from the list
 * @param option - The selected list item
 */
const handleSelectOption = (option: ListItem) => {
  if (!option?.[optionValueKey]) return

  vModel.value = option[optionValueKey] as RawValueType
  emits('change', option)
  if (closeOnSelect.value) {
    vOpen.value = false
  }
}

let scrollTimerId: any

/**
 * Automatically scrolls to the active option in the list
 */
const handleAutoScrollOption = (behavior: ScrollBehavior = 'smooth') => {
  if (scrollTimerId) {
    clearTimeout(scrollTimerId)
  }

  const option = document.querySelector('.nc-list-option-active')

  if (option) {
    scrollTimerId = setTimeout(() => {
      option?.scrollIntoView({ behavior, block: 'center' })
      clearTimeout(scrollTimerId)
    }, 50)
  }
}

const onArrowDown = () => {
  handleResetHoverEffect()

  activeOptionIndex.value = Math.min(activeOptionIndex.value + 1, list.value.length - 1)
  handleAutoScrollOption()
}

const onArrowUp = () => {
  handleResetHoverEffect()

  activeOptionIndex.value = Math.max(activeOptionIndex.value - 1, 0)
  handleAutoScrollOption()
}

const handleKeydownEnter = () => {
  if (list.value[activeOptionIndex.value]) {
    handleSelectOption(list.value[activeOptionIndex.value])
  } else if (list.value[0]) {
    handleSelectOption(list.value[activeOptionIndex.value])
  }
}

/**
 * Focuses the input box when the list is opened
 */
const focusInputBox = () => {
  if (!vOpen.value) return

  setTimeout(() => {
    inputRef.value?.focus()
  }, 100)
}

/**
 * Focuses the list wrapper when the list is opened
 *
 * This function is called when the list is opened and search is not enabled.
 * It sets a timeout to focus the list wrapper element after a short delay.
 * This allows for proper rendering and improves accessibility.
 */
const focusListWrapper = () => {
  if (!vOpen.value || isSearchEnabled.value) return

  setTimeout(() => {
    listRef.value?.focus()
  }, 100)
}

watch(
  vOpen,
  () => {
    if (!vOpen.value) return

    searchQuery.value = ''
    showHoverEffectOnSelectedOption.value = true

    if (vModel.value) {
      activeOptionIndex.value = list.value.findIndex((o) => o?.[optionValueKey] === vModel.value)

      nextTick(() => {
        handleAutoScrollOption('auto')
      })
    } else {
      activeOptionIndex.value = -1
    }

    if (isSearchEnabled.value) {
      focusInputBox()
    } else {
      focusListWrapper()
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    ref="listRef"
    tabindex="0"
    class="flex flex-col pt-2 w-64 !focus:(shadow-none outline-none)"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="handleSelectOption(list[activeOptionIndex])"
  >
    <div v-if="isSearchEnabled" class="w-full pb-2 px-2" @click.stop>
      <a-input
        ref="inputRef"
        v-model:value="searchQuery"
        :placeholder="searchInputPlaceholder || $t('placeholder.searchFields')"
        class="nc-toolbar-dropdown-search-field-input"
        allow-clear
        @keydown.enter.stop="handleKeydownEnter"
        @change="activeOptionIndex = 0"
      >
        <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
      ></a-input>
    </div>
    <slot name="header"></slot>
    <div class="nc-list-wrapper flex-col w-full max-h-[247px] nc-scrollbar-thin !overflow-y-auto px-2 pb-2">
      <template v-if="list.length">
        <div
          v-for="(option, idx) of list"
          :key="idx"
          class="flex items-center gap-2 w-full py-2 px-2 hover:bg-gray-100 cursor-pointer rounded-md"
          :class="[
            `nc-list-option-${idx}`,
            {
              'nc-list-option-selected': option[optionValueKey] === vModel,
              'bg-gray-100 ': showHoverEffectOnSelectedOption && option[optionValueKey] === vModel,
              'bg-gray-100 nc-list-option-active': activeOptionIndex === idx,
            },
          ]"
          @mouseover="handleResetHoverEffect(true)"
          @click="handleSelectOption(option)"
        >
          <slot name="listItem" :option="option" :index="idx">
            <NcTooltip class="truncate flex-1" show-on-truncate-only>
              <template #title>
                {{ option[optionLabelKey] }}
              </template>
              {{ option[optionLabelKey] }}
            </NcTooltip>
            <GeneralIcon
              v-if="showSelectedOption && option[optionValueKey] === vModel"
              id="nc-selected-item-icon"
              icon="check"
              class="flex-none text-primary w-4 h-4"
            />
          </slot>
        </div>
      </template>
      <template v-if="!list.length">
        <slot name="emptyState">
          <div class="h-full text-center flex items-center justify-center gap-3 mt-4">
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
          </div>
        </slot>
      </template>
    </div>
    <slot name="footer"></slot>
  </div>
</template>

<style lang="scss" scoped></style>
