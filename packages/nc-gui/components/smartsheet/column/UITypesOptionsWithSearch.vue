<script lang="ts" setup>
import { UITypes, UITypesName, readonlyMetaAllowedTypes } from 'nocodb-sdk'

const props = defineProps<{
  options: typeof uiTypes
  extraIcons?: Record<string, string>
}>()

const emits = defineEmits<{ selected: [UITypes] }>()

const { options } = toRefs(props)

const searchQuery = ref('')

const { isMetaReadOnly } = useRoles()

const filteredOptions = computed(
  () => options.value?.filter((c) => searchCompare([c.name, UITypesName[c.name]], searchQuery.value)) ?? [],
)

const inputRef = ref()

const activeFieldIndex = ref(-1)

const isDisabledUIType = (type: UITypes) => {
  return isMetaReadOnly.value && !readonlyMetaAllowedTypes.includes(type)
}

const onClick = (uidt: UITypes) => {
  if (!uidt || isDisabledUIType(uidt)) return

  emits('selected', uidt)
}

const handleAutoScrollOption = () => {
  const option = document.querySelector('.nc-column-list-option-active')

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
    onClick(filteredOptions.value[activeFieldIndex.value].name)
  } else if (filteredOptions.value[0]) {
    onClick(filteredOptions.value[activeFieldIndex.value].name)
  }
}

onMounted(() => {
  searchQuery.value = ''
  activeFieldIndex.value = options.value.findIndex((o) => o.name === UITypes.SingleLineText)
})

const { isSystem } = useColumnCreateStoreOrThrow()
</script>

<template>
  <div
    class="flex-1 border-1 border-gray-200 rounded-lg flex flex-col pb-2"
    data-testid="nc-column-uitypes-options-list-wrapper"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="onClick(filteredOptions[activeFieldIndex].name)"
  >
    <div class="w-full mb-2 !border-b-1" @click.stop>
      <a-input
        ref="inputRef"
        v-model:value="searchQuery"
        :placeholder="`${$t('general.search')} ${$t('labels.columnType').toLowerCase()}`"
        class="nc-column-type-search-input nc-toolbar-dropdown-search-field-input !border-none !shadow-none !py-2 !rounded-t-lg"
        :disabled="isSystem"
        @keydown.enter.stop="handleKeydownEnter"
        @change="activeFieldIndex = 0"
      >
        <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-4 w-4 mr-1" /> </template>
      </a-input>
    </div>
    <div class="nc-column-list-wrapper flex-col w-full max-h-[290px] nc-scrollbar-thin !overflow-y-auto px-2">
      <div v-if="!filteredOptions.length" class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6">
        <img
          src="~assets/img/placeholder/no-search-result-found.png"
          class="!w-[164px] flex-none"
          alt="No search results found"
        />

        {{ options.length ? $t('title.noResultsMatchedYourSearch') : 'The list is empty' }}
      </div>
      <GeneralSourceRestrictionTooltip
        v-for="(option, index) in filteredOptions"
        :key="index"
        :message="$t('tooltip.typeNotAllowed')"
        :enabled="isDisabledUIType(option.name)"
      >
        <div
          class="flex w-full py-2 items-center justify-between px-2 rounded-md"
          :class="[
            `nc-column-list-option-${index}`,
            {
              'hover:bg-gray-100 cursor-pointer': !isDisabledUIType(option.name),
              'bg-gray-100 nc-column-list-option-active': activeFieldIndex === index && !isDisabledUIType(option.name),
              '!text-gray-400 cursor-not-allowed': isDisabledUIType(option.name),
              '!text-nc-content-purple-dark': option.name === 'AIButton' || option.name === 'AIPrompt',
            },
          ]"
          :data-testid="option.name"
          @click="onClick(option.name)"
        >
          <div class="flex flex-1 gap-2 items-center">
            <component
              :is="option.icon"
              class="w-4 h-4"
              :class="isDisabledUIType(option.name) ? '!text-gray-400' : 'text-gray-700'"
            />
            <div class="flex-1 text-sm">{{ UITypesName[option.name] }}</div>
            <span v-if="option.deprecated" class="!text-xs !text-gray-300">({{ $t('general.deprecated') }})</span>
            <span v-if="option.isNew" class="text-sm text-nc-content-purple-dark bg-purple-50 px-2 rounded-md">{{
              $t('general.new')
            }}</span>
          </div>
          <GeneralIcon v-if="extraIcons && extraIcons[option.name]" class="!text-gray-500" :icon="extraIcons[option.name]" />
        </div>
      </GeneralSourceRestrictionTooltip>
    </div>
  </div>
</template>
