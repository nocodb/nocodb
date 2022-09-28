<script lang="ts" setup>
import { ReloadViewDataHookInj, computed, inject, onClickOutside, ref, useSmartsheetStoreOrThrow } from '#imports'

const reloadData = inject(ReloadViewDataHookInj)!

const { search, meta } = useSmartsheetStoreOrThrow()

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
        dropdown-class-name="!py-0 !rounded nc-dropdown-toolbar-search-field-option"
        class="!absolute top-0 left-0 w-full h-full z-10 !text-xs opacity-0"
      />
    </div>

    <a-input
      v-model:value="search.query"
      size="small"
      class="max-w-[200px]"
      :placeholder="$t('placeholder.filterQuery')"
      :bordered="false"
      @press-enter="onPressEnter"
    >
      <template #addonBefore> </template>
    </a-input>
  </div>
</template>
