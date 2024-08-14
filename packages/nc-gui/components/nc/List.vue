<script lang="ts" setup>
export type Placement = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'

export type RawValueType = string | number

interface ListItem {
  value: RawValueType
  label: string
  [key: string]: unknown
}

interface Props {
  value: RawValueType
  list: ListItem[]
  open?: boolean
  closeOnSelect?: boolean
  searchInputPlaceholder?: string
  showSelectedOption?: boolean
  filterOption?: (input: string, option: ListItem, index: Number) => boolean
}

interface Emits {
  (e: 'update:value', value: RawValueType): void
  (e: 'update:open', open: boolean): void
}

const emits = defineEmits<Emits>()

const props = withDefaults(defineProps<Props>(), {
  open: false,
  closeOnSelect: true,
  showSelectedOption: true,
})

const vModel = useVModel(props, 'value', emits)
const vOpen = useVModel(props, 'open', emits)

const { closeOnSelect, showSelectedOption } = toRefs(props)

const searchQuery = ref('')

const inputRef = ref()

const activeFieldIndex = ref(-1)

const showHoverEffectOnSelectedOption = ref(true)

const list = computed(() => {
  return props.list.filter((item, i) => {
    if (props?.filterOption) {
      return props.filterOption(searchQuery.value, item, i)
    } else {
      return item.label?.toLowerCase()?.includes(searchQuery.value.toLowerCase())
    }
  })
})

const handleResetHoverEffect = () => {
  if (!showHoverEffectOnSelectedOption.value) return

  showHoverEffectOnSelectedOption.value = false
}

const handleSelectOption = (option: ListItem) => {
  vModel.value = option.value

  if (closeOnSelect.value) {
    vOpen.value = false
  }
}

const handleAutoScrollOption = () => {
  const option = document.querySelector('.nc-list-option-active')

  if (option) {
    setTimeout(() => {
      option?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }
}

const onArrowDown = () => {
  activeFieldIndex.value = Math.min(activeFieldIndex.value + 1, list.value.length - 1)
  handleAutoScrollOption()
}

const onArrowUp = () => {
  activeFieldIndex.value = Math.max(activeFieldIndex.value - 1, 0)
  handleAutoScrollOption()
}

const handleKeydownEnter = () => {
  if (list.value[activeFieldIndex.value]) {
    handleSelectOption(list.value[activeFieldIndex.value])
  } else if (list.value[0]) {
    handleSelectOption(list.value[activeFieldIndex.value])
  }
}

const focusInputBox = () => {
  console.log('isOpen inside focus')

  if (!vOpen.value) return

  setTimeout(() => {
    inputRef.value?.focus()
  }, 100)
}

watch(
  vOpen,
  () => {
    if (!vOpen.value) return

    searchQuery.value = ''
    showHoverEffectOnSelectedOption.value = true

    focusInputBox()
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  searchQuery.value = ''
  activeFieldIndex.value = -1

  focusInputBox()
  console.log('on mounted')
})
</script>

<template>
  <div
    class="flex flex-col pt-2 w-64"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="handleSelectOption(list[activeFieldIndex])"
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
    <slot name="header"></slot>
    <div class="nc-list-wrapper flex-col w-full max-h-100 nc-scrollbar-thin !overflow-y-auto px-2 pb-2">
      <template v-if="list.length">
        <div
          v-for="(option, idx) of list"
          :key="idx"
          class="flex items-center gap-2 w-full py-[5px] px-2 hover:bg-gray-100 cursor-pointer rounded-md"
          :class="[
            `nc-list-option-${idx}`,
            {
              'bg-gray-100 nc-list-option-active': showHoverEffectOnSelectedOption && activeFieldIndex === idx,
            },
          ]"
          @mouseover="handleResetHoverEffect"
          @click="handleSelectOption(option)"
        >
          <slot name="menuItem" :option="option" :index="idx">
            <NcTooltip class="truncate flex-1" show-on-truncate-only>
              <template #title>
                {{ option.label }}
              </template>
              {{ option.label }}
            </NcTooltip>
            <GeneralIcon
              v-if="showSelectedOption && option.value === vModel"
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
