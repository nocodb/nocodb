<script setup lang="ts">
import { UseVirtualList } from '@vueuse/components'

import { type AcceptableCity, timezoneData } from './timezone-data'
import type { SelectOption } from './types'

defineProps<{
  disable: boolean
  disableMessage: string
}>()

const emits = defineEmits<{
  citySelected: [AcceptableCity]
}>()

const options: Ref<SelectOption[]> = ref(
  timezoneData.map((d) => ({
    value: d.city,
  })),
)

const inputRef = ref<HTMLInputElement>()
const searchQuery = ref('')

const onSelect = (optionValue: AcceptableCity) => {
  searchQuery.value = ''
  emits('citySelected', optionValue)
}

const filteredOptions = computed(() =>
  options.value.filter(
    (c) =>
      c.title?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.value.toLowerCase().includes(searchQuery.value.toLowerCase()),
  ),
)

const focus = () => {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

defineExpose({ focus })

const activeFieldIndex = ref(-1)

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

watch(
  options,
  () => {
    searchQuery.value = ''
    activeFieldIndex.value = options.value.length ? 0 : -1
  },
  { immediate: true },
)

const handleKeydownEnter = () => {
  if (filteredOptions.value[activeFieldIndex.value]) {
    onSelect(filteredOptions.value[activeFieldIndex.value].value as AcceptableCity)
  } else if (filteredOptions.value[0]) {
    onSelect(filteredOptions.value[activeFieldIndex.value].value as AcceptableCity)
  }
}
</script>

<template>
  <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md" @click.stop>
    <NcTooltip class="w-full" :title="disableMessage" placement="bottom" :disabled="!disable">
      <NcButton type="secondary" class="w-full" size="small" :disabled="disable">+ Add City</NcButton>
    </NcTooltip>
    <template #overlay>
      <div
        class="flex-1 rounded-lg flex flex-col"
        data-testid="nc-column-uitypes-options-list-wrapper"
        @keydown.arrow-down.prevent="onArrowDown"
        @keydown.arrow-up.prevent="onArrowUp"
        @keydown.enter.prevent="onSelect(filteredOptions[activeFieldIndex].value as AcceptableCity)"
      >
        <div class="w-full p-2" @click.stop>
          <a-input
            ref="inputRef"
            v-model:value="searchQuery"
            placeholder="Search field type"
            class="nc-column-type-search-input nc-toolbar-dropdown-search-field-input"
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
          <UseVirtualList :list="filteredOptions" height="auto" :options="{ itemHeight: 36 }">
            <template #default="{ data, index }">
              <div
                class="flex w-full py-2 items-center justify-between px-2 rounded-md"
                :class="[
                  `nc-column-list-option-${index} hover:bg-gray-100 cursor-pointer`,
                  {
                    'bg-gray-100 nc-column-list-option-active': activeFieldIndex === index,
                  },
                ]"
                @click="onSelect(data.value)"
              >
                <div class="flex flex-1 gap-2 items-center">
                  <component :is="data.icon" v-if="data.icon" class="w-4 h-4 text-gray-700" />
                  <div class="flex-1 text-sm">{{ data.title ?? data.value }}</div>
                </div>
              </div>
            </template>
          </UseVirtualList>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>
