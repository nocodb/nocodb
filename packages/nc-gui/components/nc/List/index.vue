<script lang="ts" setup>
import { useVirtualList } from '@vueuse/core'
import type { NcListProps } from '#imports'

interface Emits {
  (e: 'update:value', value: RawValueType): void
  (e: 'update:open', open: boolean): void
  (e: 'change', option: NcListItemType): void
  (e: 'escape', event: KeyboardEvent): void
}

const props = withDefaults(defineProps<NcListProps>(), {
  list: () => [] as NcListItemType[],
  open: false,
  closeOnSelect: true,
  searchInputPlaceholder: 'Search',
  showSearchAlways: false,
  showSelectedOption: true,
  optionValueKey: 'value',
  optionLabelKey: 'label',
  variant: 'default',
  isMultiSelect: false,
  minItemsForSearch: 4,
  listWrapperClassName: '',
  containerClassName: '',
  wrapperClassName: '',
  itemClassName: '',
  groupHeaderClassName: '',
  itemTooltipPlacement: 'right',
  isLocked: false,
  hideTopDivider: false,
  itemFullWidth: false,
  stopPropagationOnItemClick: false,
  searchBasisOptions: () => [] as NcListSearchBasisOptionType[],
  theme: 'default',
  groupOrder: () => [] as string[],
  groupHeaderHeight: 28,
})

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'value', emits, {
  defaultValue: props.isMultiSelect ? ([] as MultiSelectRawValueType) : undefined,
})

const vOpen = useVModel(props, 'open', emits)

const { optionValueKey, optionLabelKey } = props

const { closeOnSelect, showSelectedOption, containerClassName, itemClassName, groupHeaderClassName } = toRefs(props)

const itemHeight = computed(() => {
  if (!props.itemHeight) {
    if (props.variant === 'medium') {
      return 32
    }

    if (props.variant === 'small') {
      return 28
    }
  }

  return props.itemHeight || 40
})

const slots = useSlots()

const listRef = ref<HTMLDivElement>()

const searchQuery = ref('')

const searchBasisInfoMap = ref<Record<string, string>>({})

const inputRef = ref()

const activeOptionIndex = ref(-1)

const showHoverEffectOnSelectedOption = ref(true)

const isSearchEnabled = computed(
  () =>
    props.showSearchAlways ||
    slots.headerExtraLeft ||
    slots.headerExtraRight ||
    (props.list?.length ?? 0) > props.minItemsForSearch,
)

const keyDown = ref(false)

const listGroups = computed(() => {
  return (props.list ?? [])
    .reduce((acc, item) => {
      if (item.ncGroupHeaderLabel && !acc.includes(item.ncGroupHeaderLabel)) {
        acc.push(item.ncGroupHeaderLabel)
      }

      return acc
    }, [] as string[])
    .sort((a, b) => {
      // If group order is provided, then we can use it to sort the groups
      if (props.groupOrder?.length) {
        return props.groupOrder.indexOf(a) - props.groupOrder.indexOf(b)
      }

      // If no group order is provided, then we can use the default locale compare to sort the groups
      return a.localeCompare(b)
    })
})

/**
 * Default filter function that checks if the item matches the search query.
 * If a custom filter function is provided via props.filterOption, it will be used instead of the default filtering logic.
 *
 * @returns {boolean} - True if the item matches the search query, false otherwise
 */
const defaultFilter = (item: NcListItemType, i: number, _array: NcListItemType[], query: string) => {
  if (props?.filterOption) {
    return props.filterOption(query, item, i)
  }

  return searchCompare(item[optionLabelKey], query)
}

const applyFilterOnList = (listToFilter: NcListItemType[], query: string) => {
  return listToFilter.filter((item, i, array) => {
    // Step 1: apply default filter
    if (defaultFilter(item, i, array, query)) return true

    // Step 2: apply search basis options
    for (const basisOption of props.searchBasisOptions) {
      if (!basisOption.filterCallback(query, item, i)) continue

      searchBasisInfoMap.value[item[optionValueKey]] = basisOption.searchBasisInfo ?? ''

      return true
    }

    return false
  })
}

/**
 * Computed property that filters the list of options based on the search query.
 *
 * @returns Filtered list of options
 */
const list = computed(() => {
  const query = searchQuery.value.toLowerCase()

  searchBasisInfoMap.value = {}

  /**
   * If the list has no groups, we can use default method to filter the list
   */
  if (!listGroups.value.length) {
    // If no query, return all items
    if (!query) return props.list ?? []

    return applyFilterOnList(props.list ?? [], query)
  }

  /**
   * If list has groups, then we have to append the group label items in the list and sort & filter accordingly
   * We have to filter list first and then group, if group list is empty, then don't add that group label item in the list
   */
  const filteredList = applyFilterOnList(props.list ?? [], query)

  const listWithGroups = listGroups.value.reduce((acc, group) => {
    const groupList = filteredList.filter((item) => item.ncGroupHeaderLabel === group)

    // If group list is empty, then don't add that group label item in the list
    if (!groupList.length) return acc

    // Push group label item in the list first
    acc.push({
      ncGroupHeaderLabel: group,
      ncGroupHeader: true,
      label: group,
      value: group,
    })

    // Push group list items in the list
    acc.push(...groupList)

    return acc
  }, [] as NcListItemType[])

  return listWithGroups
})

const {
  list: virtualList,
  containerProps,
  wrapperProps,
  scrollTo,
} = useVirtualList(list, {
  itemHeight: itemHeight.value + 2,
})

/**
 * Revised wrapper props to fix scroll area issue
 *
 * `useVirtualList` support only constant item height and in our case group height height is different so,
 * to fix scroll area we have to calculate the height of the wrapper props
 */
const revisedWrapperProps = computed(() => {
  const virtualListHeight = virtualList.value.length * (itemHeight.value + 2)

  const groupHeaders = virtualList.value.filter((item) => item.data.ncGroupHeader)

  const groupHeaderHeight = groupHeaders.length * (props.groupHeaderHeight + 2)

  const totalHeight = parseFloat(virtualListHeight.toString()) - groupHeaders.length * (itemHeight.value + 2) + groupHeaderHeight

  return {
    ...(wrapperProps.value || {}),
    style: {
      ...(wrapperProps.value?.style || {}),
      height: `${totalHeight}px`,
    },
  }
})

/**
 * Compares the given value with the current vModel value.
 * If the component is in multi-select mode, it checks if the value is included in the vModel array.
 * Otherwise, it performs a direct equality check.
 *
 * @param value - The value to compare with the vModel value.
 * @returns {boolean} - True if the value matches the vModel value, false otherwise.
 */
function compareVModel(value: string | number, isGroupHeader = false): boolean {
  if (isGroupHeader) return false

  if (props.isMultiSelect) {
    return (vModel.value as MultiSelectRawValueType).includes(value)
  }

  return vModel.value === value
}

/**
 * Resets the hover effect on the selected option
 * @param clearActiveOption - Whether to clear the active option index
 */
const handleResetHoverEffect = (clearActiveOption = false, newActiveIndex?: number) => {
  if ((clearActiveOption && keyDown.value) || (clearActiveOption && activeOptionIndex.value === newActiveIndex)) {
    return
  }

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
const handleSelectOption = (option: NcListItemType, index?: number, e?: MouseEvent) => {
  if (e && props.stopPropagationOnItemClick) {
    e.stopPropagation()
  }

  if (props.isLocked) return
  if (!ncIsObject(option) || !(optionValueKey in option) || option.ncItemDisabled || option.ncGroupHeader) return
  if (index !== undefined) {
    activeOptionIndex.value = index
  }

  if (props.isMultiSelect) {
    if ((vModel.value as MultiSelectRawValueType).includes(option?.[optionValueKey])) {
      vModel.value = (vModel.value as MultiSelectRawValueType).filter((op) => op !== option?.[optionValueKey])
    } else {
      vModel.value = [...(vModel.value as MultiSelectRawValueType), option?.[optionValueKey]]
    }
  } else {
    vModel.value = option[optionValueKey] as RawValueType
  }

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

/**
 * Get the next enabled option index
 *
 * @param currentIndex - The current option index
 * @param increment - Whether to increment the index
 * @returns The next enabled option index
 * @Note Important: Skip disabled and group header options
 * Increment - true
 * - If current option is the last option, then return the first enabled option index
 *
 * Increment - false
 * - If current option is the first option, then return the last enabled option index
 */
const getNextEnabledOptionIndex = (currentIndex: number, increment = true) => {
  const listLength = list.value.length

  let nextIndex = -1

  if (increment) {
    nextIndex = currentIndex === listLength - 1 ? 0 : currentIndex + 1
  } else {
    nextIndex = currentIndex === 0 ? listLength - 1 : currentIndex - 1
  }

  if (list.value[nextIndex]?.ncItemDisabled || list.value[nextIndex]?.ncGroupHeader) {
    return getNextEnabledOptionIndex(nextIndex, increment)
  }

  return nextIndex
}

const onArrowDown = () => {
  keyDown.value = true
  handleResetHoverEffect()

  activeOptionIndex.value = getNextEnabledOptionIndex(activeOptionIndex.value, true)
  handleAutoScrollOption()

  ncDelay(100).then(() => {
    keyDown.value = false
  })
}

const onArrowUp = () => {
  keyDown.value = true
  handleResetHoverEffect()

  activeOptionIndex.value = getNextEnabledOptionIndex(activeOptionIndex.value, false)
  handleAutoScrollOption()

  ncDelay(100).then(() => {
    keyDown.value = false
  })
}

const handleKeydownEnter = (event: KeyboardEvent) => {
  event.preventDefault()
  event.stopPropagation()

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

    if (props.isMultiSelect) {
      showHoverEffectOnSelectedOption.value = false
    } else {
      showHoverEffectOnSelectedOption.value = true
    }

    if (vModel.value && !props.isMultiSelect) {
      activeOptionIndex.value = list.value.findIndex((o) => compareVModel(o?.[optionValueKey], o?.ncGroupHeader))

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

watch(searchQuery, () => {
  if (activeOptionIndex.value === -1) return

  nextTick(() => {
    handleAutoScrollOption()
  })
})

defineExpose({
  list,
})

const handleEscape = (event: KeyboardEvent) => {
  emits('escape', event)
}
</script>

<template>
  <div
    ref="listRef"
    tabindex="-1"
    class="flex flex-col nc-list-root pt-2 w-64 !focus:(shadow-none outline-none)"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="handleSelectOption(list[activeOptionIndex], undefined, $event)"
    @keydown.esc="handleEscape($event)"
  >
    <template v-if="isSearchEnabled">
      <div
        class="w-full flex items-center gap-2"
        :class="{
          'px-1': variant === 'small',
          'px-2': variant !== 'small',
        }"
        @click.stop
      >
        <slot name="headerExtraLeft"> </slot>
        <a-input
          ref="inputRef"
          v-model:value="searchQuery"
          :placeholder="searchInputPlaceholder"
          class="nc-toolbar-dropdown-search-field-input !pl-2 !pr-1.5 flex-1"
          :class="`nc-theme-${theme}`"
          allow-clear
          :bordered="inputBordered"
          autocomplete="off"
          @keydown.enter.stop="handleKeydownEnter"
          @change="handleResetHoverEffect(false, 0)"
        >
          <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template>
        </a-input>
        <slot name="headerExtraRight"> </slot>
      </div>
      <NcDivider v-if="!hideTopDivider" class="!my-1" />
    </template>

    <slot name="listHeader"></slot>
    <div
      class="nc-list-wrapper"
      :class="[
        listWrapperClassName,
        {
          'cursor-not-allowed': isLocked,
          'pb-1': variant === 'small',
          'pb-2': variant !== 'small',
        },
      ]"
    >
      <template v-if="list.length">
        <div class="h-auto !max-h-[247px]">
          <div
            v-bind="containerProps"
            class="nc-list !h-auto w-full nc-scrollbar-thin !max-h-[247px]"
            :class="[
              containerClassName,
              {
                'px-1': variant === 'small',
                'px-2': variant !== 'small',
                '!px-0': itemFullWidth,
              },
            ]"
          >
            <div v-bind="revisedWrapperProps" :class="wrapperClassName">
              <NcTooltip
                v-for="{ data: option, index: idx } in virtualList"
                :key="idx"
                class="flex items-center gap-2 nc-list-item w-full px-2 my-[2px] first-of-type:mt-0 last-of-type:mb-0"
                :class="[
                  `nc-list-option-${idx}`,
                  {
                    'nc-list-group-header text-nc-content-gray-muted text-bodySmBold border-t first:!border-t-transparent !border-t-nc-border-gray-medium flex items-center':
                      option.ncGroupHeader,
                    'rounded-md': !itemFullWidth && !option.ncGroupHeader,
                    'nc-list-option-selected': compareVModel(option[optionValueKey], option.ncGroupHeader),
                    'bg-nc-bg-gray-light ':
                      !option?.ncItemDisabled &&
                      showHoverEffectOnSelectedOption &&
                      compareVModel(option[optionValueKey], option.ncGroupHeader),
                    'bg-nc-bg-gray-light nc-list-option-active':
                      !option?.ncItemDisabled && activeOptionIndex === idx && !option.ncGroupHeader,
                    'opacity-60 cursor-not-allowed': option?.ncItemDisabled && !option?.ncGroupHeader,
                    'hover:bg-nc-bg-gray-light cursor-pointer': !option?.ncItemDisabled && !option?.ncGroupHeader,
                    'py-2': variant === 'default' && !option.ncGroupHeader,
                    'py-[5px]': variant === 'medium' && !option.ncGroupHeader,
                    'py-[3px]': variant === 'small' && !option.ncGroupHeader,
                    '-mx-1 px-3 w-[calc(100%_+_8px)]': variant === 'small' && option.ncGroupHeader,
                    '-mx-2 px-4 w-[calc(100%_+_16px)]': variant !== 'small' && option.ncGroupHeader,
                    'pointer-events-none': isLocked,
                  },
                  `${itemClassName}`,
                  `${option.ncGroupHeader ? groupHeaderClassName : ''}`,
                ]"
                :style="{
                  minHeight: `${groupHeaderHeight}px`,
                }"
                :placement="itemTooltipPlacement"
                :disabled="!option?.ncItemTooltip"
                :attrs="{
                  onMouseover: () => !option.ncGroupHeader && handleResetHoverEffect(true, idx),
                }"
                @click="handleSelectOption(option, idx, $event)"
              >
                <template #title>{{ option.ncItemTooltip }} </template>
                <slot v-if="option.ncGroupHeader" name="listItemGroupHeader" :option="option">
                  <div>
                    {{ option.ncGroupHeaderLabel }}
                  </div>
                </slot>
                <slot
                  v-else
                  name="listItem"
                  :option="option"
                  :is-selected="compareVModel(option[optionValueKey], option.ncGroupHeader)"
                  :index="idx"
                  :search-basis-info="searchBasisInfoMap[option[optionValueKey]]"
                >
                  <slot
                    name="listItemExtraLeft"
                    :option="option"
                    :is-selected="compareVModel(option[optionValueKey], option.ncGroupHeader)"
                    :search-basis-info="searchBasisInfoMap[option[optionValueKey]]"
                  >
                  </slot>

                  <slot
                    name="listItemContent"
                    :option="option"
                    :is-selected="compareVModel(option[optionValueKey], option.ncGroupHeader)"
                    :search-basis-info="searchBasisInfoMap[option[optionValueKey]]"
                  >
                    <NcTooltip
                      class="truncate"
                      :class="{
                        'flex-1': !searchBasisInfoMap[option[optionValueKey]],
                      }"
                      show-on-truncate-only
                    >
                      <template #title>
                        {{ option[optionLabelKey] }}
                      </template>
                      {{ option[optionLabelKey] }}
                    </NcTooltip>
                    <div v-if="!option?.ncGroupHeader && searchBasisInfoMap[option[optionValueKey]]" class="flex-1 flex">
                      <NcTooltip :title="searchBasisInfoMap[option[optionValueKey]]" class="flex cursor-help">
                        <GeneralIcon icon="info" class="flex-none h-3.5 w-3.5 text-nc-content-gray-muted" />
                      </NcTooltip>
                    </div>
                  </slot>

                  <slot
                    name="listItemExtraRight"
                    :option="option"
                    :is-selected="compareVModel(option[optionValueKey], option.ncGroupHeader)"
                    :search-basis-info="searchBasisInfoMap[option[optionValueKey]]"
                  >
                  </slot>

                  <slot
                    name="listItemSelectedIcon"
                    :option="option"
                    :is-selected="compareVModel(option[optionValueKey], option.ncGroupHeader)"
                  >
                    <GeneralIcon
                      v-if="showSelectedOption && compareVModel(option[optionValueKey], option.ncGroupHeader)"
                      id="nc-selected-item-icon"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </slot>
                </slot>
              </NcTooltip>
            </div>
          </div>
        </div>
      </template>
      <template v-if="!list.length">
        <slot name="emptyState">
          <div class="h-full text-center flex items-center justify-center gap-3 mt-4">
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="emptyDescription || $t('labels.noData')" class="!my-0" />
          </div>
        </slot>
      </template>
    </div>
    <slot name="listFooter"></slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-toolbar-dropdown-search-field-input) {
  .ant-input {
    @apply placeholder-gray-500;
  }
}
</style>
