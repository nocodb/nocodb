<script lang="ts" setup>
import { computed, inject, ref, useSmartsheetStoreOrThrow } from '#imports'
import { ReloadViewDataHookInj } from '~/context'

const reloadData = inject(ReloadViewDataHookInj)!

const { search, meta } = useSmartsheetStoreOrThrow()

// todo: where is this value supposed to come from? it's not in the store
const isDropdownOpen = ref(false)
const searchDropdown = ref(null)
onClickOutside(searchDropdown, () => (isDropdownOpen.value = false))

const columns = computed(() =>
  meta.value?.columns?.map((c) => ({
    value: c.id,
    label: c.title,
  })),
)

function onPressEnter() {
  reloadData.trigger()
}
</script>

<template>
  <div class="flex flex-row border-1 rounded-sm">
    <div
      ref="searchDropdown"
      class="flex items-center relative bg-gray-50 px-2 cursor-pointer border-r-1"
      :class="{ '!bg-gray-100 ': isDropdownOpen }"
      @click="isDropdownOpen = !isDropdownOpen"
    >
      <MdiMagnify class="text-grey" />
      <MdiMenuDown class="text-grey" />

      <a-select
        v-model:value="search.field"
        :open="isDropdownOpen"
        size="small"
        :dropdown-match-select-width="false"
        :options="columns"
        class="!absolute top-0 left-0 w-full h-full z-10 !text-xs opacity-0"
      >
      </a-select>
    </div>
    <a-input
      v-model:value="search.query"
      size="small"
      class="max-w-[200px]"
      placeholder="Filter query"
      :bordered="false"
      @press-enter="onPressEnter"
    >
      <template #addonBefore> </template>
    </a-input>
  </div>
</template>
