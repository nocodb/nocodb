<script lang="ts" setup>
import { useProvideSmartsheetStore, useSmartsheetStoreOrThrow } from '~/composables/useSmartsheetStore'
import { MetaInj, ReloadViewDataHookInj } from '~/context'
import MdiSearchIcon from '~icons/mdi/magnify'
import MdiMenuDownIcon from '~icons/mdi/menu-down'

const reloadData = inject(ReloadViewDataHookInj)
const { search, meta } = useSmartsheetStoreOrThrow()

const columns = computed(() =>
  meta?.value?.columns?.map((c) => ({
    value: c.id,
    label: c.title,
  })),
)

</script>

<template>
  <a-input
    v-model:value="search.value"
    size="small"
    class="max-w-[200px]"
    placeholder="Filter query"
    @press-enter="reloadData.trigger()"
  >
    <template #addonBefore @click="isDropdownOpen = true">
      <div class="flex align-center relative">
      <MdiSearchIcon class="text-grey"/>
      <MdiMenuDownIcon class="text-grey"/>
      <a-select size="small" :dropdownMatchSelectWidth="false" v-model:value="search.field" :options="columns"  class="!absolute top-0 left-0 w-full h-full z-10 !text-xs opacity-0">
      </a-select>
      </div>
    </template>
  </a-input>
</template>

<style scoped></style>
