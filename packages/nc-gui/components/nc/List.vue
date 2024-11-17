<script lang="ts" setup>
import { useVirtualList } from '@vueuse/core'

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
  /**
   * Whether to close the list after an item is selected
   * @default true
   */
  closeOnSelect?: boolean
  /** Placeholder text for the search input */
  searchInputPlaceholder?: string
  /** Whether to show the currently selected option */
  showSelectedOption?: boolean
  /**
   * The height of each item in the list, used for virtual list rendering.
   * @default 38
   */
  itemHeight?: number
  /** Custom filter function for list items */
  filterOption?: (input: string, option: ListItem, index: Number) => boolean
}

interface Emits {
  (e: 'update:value', value: RawValueType): void
  (e: 'update:open', open: boolean): void
  (e: 'change', option: ListItem): void
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  closeOnSelect: true,
  searchInputPlaceholder: '',
  showSelectedOption: true,
  optionValueKey: 'value',
  optionLabelKey: 'label',
  itemHeight: 38,
})

const emits = defineEmits<Emits>()

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
 * Computed property that filters the list of options based on the search query.
 * If a custom filter function is provided via props.filterOption, it will be used instead of the default filtering logic.
 *
 * @returns Filtered list of options
 *
 * @typeparam ListItem - The type of items in the list
 */
const list = computed(() => {
  const query = searchQuery.value.toLowerCase()

  return props.list.filter((item, i) => {
    if (props?.filterOption) {
      return props.filterOption(query, item, i)
    } else {
      return item[optionLabelKey]?.toLowerCase()?.includes(query)
    }
  })
})

const {
  list: virtualList,
  containerProps,
  wrapperProps,
  scrollTo,
} = useVirtualList(list, {
  itemHeight: props.itemHeight,
})

/**
 * Resets the hover effect on the selected option
 * @param clearActiveOption - Whether to clear the active option index
 */
const handleResetHoverEffect = (clearActiveOption = false, newActiveIndex?: number) => {
  if (clearActiveOption && showHoverEffectOnSelectedOption.value) {
    activeOptionIndex.value = -1
  }

  if (newActiveIndex !== undefined) {
    activeOptionIndex.value = newActiveIndex
  }

  if (!showHoverEffectOnSelectedOption.value) return

  showHoverEffectOnSelectedOption.value = false
}

/**
 * Handles the selection of an option from the list
 *
 * @param option - The selected list item
 *
 * This function is responsible for handling the selection of an option from the list.
 * It updates the model value, emits a change event, and optionally closes the dropdown.
 */
const handleSelectOption = (option: ListItem) => {
  if (!option?.[optionValueKey]) return

  vModel.value = option[optionValueKey] as RawValueType
  emits('change', option)
  if (closeOnSelect.value) {
    vOpen.value = false
  }
}

/**
 * Automatically scrolls to the active option in the list
 */
const handleAutoScrollOption = (useDelay = false) => {
  if (activeOptionIndex.value === -1) return

  if (!useDelay) {
    scrollTo(activeOptionIndex.value)
    return
  }

  setTimeout(() => {
    scrollTo(activeOptionIndex.value)
  }, 150)
}

const onArrowDown = () => {
  handleResetHoverEffect()

  if (activeOptionIndex.value === list.value.length - 1) return

  activeOptionIndex.value = Math.min(activeOptionIndex.value + 1, list.value.length - 1)
  handleAutoScrollOption()
}

const onArrowUp = () => {
  handleResetHoverEffect()

  if (activeOptionIndex.value === 0) return

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
        handleAutoScrollOption(true)
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
    <template v-if="isSearchEnabled">
      <div class="w-full px-2" @click.stop>
        <a-input
          ref="inputRef"
          v-model:value="searchQuery"
          :placeholder="searchInputPlaceholder"
          class="nc-toolbar-dropdown-search-field-input !pl-2 !pr-1.5"
          allow-clear
          :bordered="false"
          @keydown.enter.stop="handleKeydownEnter"
          @change="handleResetHoverEffect(false, 0)"
        >
          <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
        ></a-input>
      </div>
      <NcDivider />
    </template>

    <slot name="listHeader"></slot>
    <div class="nc-list-wrapper">
      <template v-if="list.length">
        <div class="h-auto !max-h-[247px]">
          <div
            v-bind="containerProps"
            class="nc-list !h-auto w-full nc-scrollbar-thin px-2 pb-2"
            :style="{
              maxHeight: '247px !important',
            }"
          >
            <div v-bind="wrapperProps">
              <div
                v-for="{ data: option, index: idx } in virtualList"
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
            </div>
          </div>
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
    <slot name="listFooter"></slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-toolbar-dropdown-search-field-input) {
  &.ant-input-affix-wrapper-focused {
    .ant-input-prefix svg {
      @apply text-brand-500;
    }
  }
  .ant-input {
    @apply placeholder-gray-500;
  }
}
</style>
