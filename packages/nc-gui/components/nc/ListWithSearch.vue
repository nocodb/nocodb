<script setup lang="ts" generic="T">
const props = withDefaults(
  defineProps<{
    // As we need to focus search box when the parent is opened
    isParentOpen: boolean
    searchInputPlaceholder?: string
    optionConfig: {
      optionClassName: string
      selectOptionEvent: string[] | undefined
    }
    options: Array<T>
    disableMascot?: boolean
    selectedOptionId?: string
    uniqueIdentifier?: keyof T
    filterField: keyof T
    showSelectedOption?: boolean
  }>(),
  {
    uniqueIdentifier: 'id' as keyof T,
  },
)

const emits = defineEmits<{ (e: 'selected', value: T): void }>()

defineSlots<{
  default: (props: { option: T }) => any
  bottom: () => any
}>()

const {
  isParentOpen,
  searchInputPlaceholder,
  selectedOptionId,
  showSelectedOption,
  filterField,
  options,
  optionConfig,
  disableMascot,
  uniqueIdentifier,
} = toRefs(props)

const inputRef = ref()

const activeOptionIndex = ref(-1)

const searchQuery = ref('')

const { t } = useI18n()

const wrapperRef = ref()

const handleAutoScrollOption = () => {
  const option = document.querySelector('.nc-unified-list-option-active')

  if (option) {
    setTimeout(() => {
      option?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }
}

const filteredOptions = computed(
  () =>
    options.value?.filter((c: T) => (c[filterField.value] as string)?.toLowerCase().includes(searchQuery.value.toLowerCase())) ??
    [],
)

const onArrowDown = () => {
  activeOptionIndex.value = Math.min(activeOptionIndex.value + 1, filteredOptions.value.length - 1)
  handleAutoScrollOption()
}

const onArrowUp = () => {
  activeOptionIndex.value = Math.max(activeOptionIndex.value - 1, 0)
  handleAutoScrollOption()
}

const onClick = (column: T) => {
  if (!column) return

  emits('selected', column)
}

const handleKeydownEnter = () => {
  if (filteredOptions.value[activeOptionIndex.value]) {
    onClick(filteredOptions.value[activeOptionIndex.value])
  } else if (filteredOptions.value[0]) {
    onClick(filteredOptions.value[activeOptionIndex.value])
  }
}

onMounted(() => {
  searchQuery.value = ''
  activeOptionIndex.value = -1
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
    ref="wrapperRef"
    class="flex flex-col pt-2 nc-list-with-search w-64"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="onClick(filteredOptions[activeOptionIndex])"
  >
    <div class="w-full pb-2 px-2" @click.stop>
      <a-input
        ref="inputRef"
        v-model:value="searchQuery"
        :placeholder="searchInputPlaceholder || t('placeholder.search')"
        class="nc-dropdown-search-unified-input"
        @keydown.enter.stop="handleKeydownEnter"
        @change="activeOptionIndex = 0"
      >
        <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
      ></a-input>
    </div>

    <div class="nc-unified-search-list-wrapper flex-col w-full max-h-100 nc-scrollbar-thin !overflow-y-auto px-2 pb-2">
      <div v-if="!filteredOptions.length" class="px-2 py-6 text-center text-gray-500 flex flex-col items-center gap-6">
        <img
          v-if="!disableMascot"
          src="~assets/img/placeholder/no-search-result-found.png"
          class="!w-[164px] flex-none"
          alt="No search results found"
        />

        {{ options.length ? t('title.noResultsMatchedYourSearch') : 'The list is empty' }}
      </div>

      <div
        v-for="(option, index) in filteredOptions"
        :key="index"
        v-e="optionConfig.selectOptionEvent"
        class="flex w-full py-[5px] items-center justify-between px-2 hover:bg-gray-100 cursor-pointer rounded-md"
        :class="[
          `${optionConfig.optionClassName}`,
          `nc-unified-list-option-${index}`,
          {
            'bg-gray-100 nc-unified-list-option-active': activeOptionIndex === index,
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
          <slot :option="option" />
          <NcTooltip class="truncate" show-on-truncate-only>
            <template #title> {{ option.title }}</template>
            <span>
              {{ option.title }}
            </span>
          </NcTooltip>
        </div>
        <GeneralIcon
          v-if="showSelectedOption && option[uniqueIdentifier] === selectedOptionId"
          icon="check"
          class="flex-none text-primary w-4 h-4"
        />
      </div>

      <slot name="bottom" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-unified-search-list-wrapper {
  max-height: min(400px, calc(100vh - 120px));
}
</style>
